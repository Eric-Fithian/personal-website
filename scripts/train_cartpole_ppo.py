import argparse
import json
import math
import pathlib
import gymnasium
import numpy
import stable_baselines3
from stable_baselines3.common.callbacks import BaseCallback
from stable_baselines3.common.monitor import Monitor
from stable_baselines3.common.vec_env import SubprocVecEnv
import torch

_CONFIG_PATH = pathlib.Path(__file__).resolve().parent.parent / "config" / "cartpole_config.json"
with _CONFIG_PATH.open() as f:
    _CFG = json.load(f)

GRAVITY = _CFG["gravity"]
MASS_CART = _CFG["massCart"]
MASS_POLE = _CFG["massPole"]
TOTAL_MASS = MASS_CART + MASS_POLE
HALF_POLE_LENGTH = _CFG["halfPoleLength"]
POLE_MASS_LENGTH = MASS_POLE * HALF_POLE_LENGTH
FORCE_MAG = _CFG["forceMag"]
CONTROL_ACCELERATION_SCALE = _CFG["controlAccelerationScale"]
CART_LINEAR_DRAG = _CFG["cartLinearDrag"]
POLE_ANGULAR_DAMPING = _CFG["poleAngularDamping"]
SIM_DT = 1.0 / _CFG["stepsPerSecond"]
TRACK_HALF_LENGTH = _CFG["trackHalfLength"]
MAX_SPEED = _CFG["maxSpeed"]
MAX_WIND_FORCE = _CFG["maxWindForce"]
CLICK_WIND_FORCE = _CFG["clickWindForce"]
WIND_DECAY_PER_SECOND = _CFG["windDecayPerSecond"]
WIND_ACTIVE_DURATION_SECONDS = _CFG["windActiveDurationSeconds"]
WIND_CART_COUPLING = _CFG["windCartCoupling"]
WIND_POLE_COUPLING = _CFG["windPoleCoupling"]
MAX_WALL_HITS_PER_EPISODE = 2
CART_BOUNCE_RESTITUTION = _CFG["cartBounceRestitution"]
MAX_STEPS_PER_EPISODE = 1800
THETA_DOT_REF = _CFG.get("thetaDotRef", 2.0 * math.pi)
WIND_IMPULSE_GAIN = _CFG.get("windImpulseGain", 7.5)
TRACK_HALF_LENGTH_MIN = 1.2
TRACK_HALF_LENGTH_MAX = 4.8
WIND_POLE_COUPLING_MIN = 0.5
WIND_POLE_COUPLING_MAX = 1.2
CLICK_WIND_FORCE_MIN = 5.0
CLICK_WIND_FORCE_MAX = 25.0
POISSON_SMALL_IMPULSE_HZ = 3.5
POISSON_LARGE_IMPULSE_HZ = 0.3
TYPICAL_MOUSE_VELOCITY_PX_MS = 1.0



class RewardDecompositionCallback(BaseCallback):
    def __init__(self, log_freq=10, keep_last=20, verbose=0):
        super().__init__(verbose)
        self._log_freq = log_freq
        self._keep_last = keep_last
        self._episode_counts = None
        self._episode_sums = None
        self._recent_breakdowns = []

    def _on_training_start(self):
        n_envs = self.training_env.num_envs
        self._episode_counts = [0] * n_envs
        self._episode_sums = [dict.fromkeys(["upright", "centered", "small_velocity", "small_control", "reward", "steps"], 0.0) for _ in range(n_envs)]
        self._recent_breakdowns = []

    def _on_step(self):
        for i, info in enumerate(self.locals.get("infos", [])):
            if not info:
                continue
            for key, total_key in [
                ("reward_upright", "upright"),
                ("reward_centered", "centered"),
                ("reward_small_velocity", "small_velocity"),
                ("reward_small_control", "small_control"),
                ("reward", "reward"),
                ("reward_steps", "steps"),
            ]:
                if key in info:
                    self._episode_sums[i][total_key] += info[key]
        dones = self.locals.get("dones", [])
        for i, done in enumerate(dones):
            if done and self._episode_sums[i]["upright"] != 0:
                self._episode_counts[i] += 1
                if self._episode_counts[i] % self._log_freq == 0:
                    s = self._episode_sums[i]
                    wall_hits = self.locals.get("infos", [{}])[i].get("wall_hits", "?")
                    n = int(s["steps"]) if s["steps"] else 1
                    mean_upright = s["upright"] / n
                    mean_centered = s["centered"] / n
                    mean_vel = s["small_velocity"] / n
                    mean_ctrl = s["small_control"] / n
                    line = (
                        f"  [ep {self._episode_counts[i]}] "
                        f"upright={mean_upright:.2f} centered={mean_centered:.2f} "
                        f"vel={mean_vel:.2f} ctrl={mean_ctrl:.2f} total={s['reward']:.0f} | wall_hits={wall_hits}"
                    )
                    print(line)
                    self._recent_breakdowns.append((self._episode_counts[i], line))
                    if len(self._recent_breakdowns) > self._keep_last:
                        self._recent_breakdowns.pop(0)
                for k in self._episode_sums[i]:
                    self._episode_sums[i][k] = 0.0
        return True

    def _on_training_end(self):
        if self._recent_breakdowns:
            print("\n--- Reward breakdown (last episodes) ---")
            for _, line in self._recent_breakdowns:
                print(line)
            print("---")


def main():
    parser = argparse.ArgumentParser(description="Train SAC for website cart-pole dynamics and export JS policy.")
    parser.add_argument("--timesteps", type=int, default=500_000, help="Total SAC training timesteps.")
    parser.add_argument("--seed", type=int, default=7, help="Random seed for training.")
    parser.add_argument(
        "--model-out",
        type=pathlib.Path,
        default=pathlib.Path("artifacts/cartpole_sac.zip"),
        help="Output path for SAC model zip.",
    )
    parser.add_argument(
        "--policy-out",
        type=pathlib.Path,
        default=pathlib.Path("src/assets/cartpole_policy.json"),
        help="Output path for exported policy JSON used by the website.",
    )
    parser.add_argument("--n-envs", type=int, default=8, help="Number of parallel environments.")
    args = parser.parse_args()

    numpy.random.seed(args.seed)
    torch.manual_seed(args.seed)

    def make_env(rank: int):
        def _init():
            env = WebsiteCartPoleEnv(seed=args.seed + rank)
            return Monitor(env)
        return _init

    env = SubprocVecEnv([make_env(i) for i in range(args.n_envs)])
    callback = RewardDecompositionCallback(log_freq=10)
    model = stable_baselines3.SAC(
        "MlpPolicy",
        env,
        device="cpu",
        learning_rate=3e-4,
        buffer_size=1_000_000,
        batch_size=256,
        tau=0.005,
        gamma=0.99,
        ent_coef="auto",
        target_entropy="auto",
        policy_kwargs={
            "net_arch": [256, 256],
            "activation_fn": torch.nn.Tanh,
        },
        verbose=1,
        seed=args.seed,
    )
    model.learn(total_timesteps=args.timesteps, progress_bar=True, callback=callback)
    env.close()

    args.model_out.parent.mkdir(parents=True, exist_ok=True)
    model.save(str(args.model_out))

    policy_payload = export_policy_payload(model)
    args.policy_out.parent.mkdir(parents=True, exist_ok=True)
    args.policy_out.write_text(json.dumps(policy_payload, separators=(",", ":"), ensure_ascii=True))

    print(f"Saved model: {args.model_out}")
    print(f"Saved policy JSON: {args.policy_out}")


class WebsiteCartPoleEnv(gymnasium.Env):
    metadata = {"render_modes": []}

    def __init__(self, seed: int):
        super().__init__()
        self.action_space = gymnasium.spaces.Box(low=-1.0, high=1.0, shape=(1,), dtype=numpy.float32)
        wind_bound = max(MAX_WIND_FORCE, CLICK_WIND_FORCE_MAX) / FORCE_MAG
        low = numpy.array([0.0, 0.0, -1.0, -1.0, -1.0, -1.0, -wind_bound], dtype=numpy.float32)
        high = numpy.array([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, wind_bound], dtype=numpy.float32)
        self.observation_space = gymnasium.spaces.Box(low=low, high=high, dtype=numpy.float32)
        self._rng = numpy.random.default_rng(seed)
        self._x = 0.0
        self._x_dot = 0.0
        self._theta = 0.0
        self._theta_dot = 0.0
        self._wind_force = 0.0
        self._wind_age_seconds = float("inf")
        self._step_count = 0
        self._wall_hit_count = 0
        self._track_half_length = TRACK_HALF_LENGTH
        self._wind_pole_coupling = WIND_POLE_COUPLING
        self._click_wind_force = CLICK_WIND_FORCE

    def reset(self, *, seed=None, options=None):
        if seed is not None:
            self._rng = numpy.random.default_rng(seed)
        self._track_half_length = float(self._rng.uniform(TRACK_HALF_LENGTH_MIN, TRACK_HALF_LENGTH_MAX))
        self._wind_pole_coupling = float(self._rng.uniform(WIND_POLE_COUPLING_MIN, WIND_POLE_COUPLING_MAX))
        self._click_wind_force = float(self._rng.uniform(CLICK_WIND_FORCE_MIN, CLICK_WIND_FORCE_MAX))
        self._x = float(self._rng.uniform(-0.05, 0.05))
        self._x_dot = float(self._rng.uniform(-0.05, 0.05))
        self._theta = math.pi
        self._theta_dot = float(self._rng.uniform(-0.08, 0.08))
        self._wind_force = 0.0
        self._wind_age_seconds = float("inf")
        self._step_count = 0
        self._wall_hit_count = 0
        return self._get_obs(), {}

    def step(self, action):
        control_force = float(numpy.clip(action[0], -1.0, 1.0) * FORCE_MAG * CONTROL_ACCELERATION_SCALE)
        wall_hit = False

        self._wind_age_seconds += SIM_DT
        small_prob = POISSON_SMALL_IMPULSE_HZ * SIM_DT
        large_prob = POISSON_LARGE_IMPULSE_HZ * SIM_DT
        if self._rng.random() < large_prob:
            self._wind_force = float(self._rng.choice([-1.0, 1.0]) * self._click_wind_force)
            self._wind_age_seconds = 0.0
        elif self._rng.random() < small_prob:
            mag = WIND_IMPULSE_GAIN * TYPICAL_MOUSE_VELOCITY_PX_MS * float(self._rng.uniform(0.3, 1.0))
            self._wind_force = float(self._rng.choice([-1.0, 1.0]) * mag)
            self._wind_age_seconds = 0.0
        if self._wind_age_seconds > WIND_ACTIVE_DURATION_SECONDS:
            self._wind_force = 0.0
        else:
            self._wind_force *= math.exp(-WIND_DECAY_PER_SECOND * SIM_DT)
            if abs(self._wind_force) < 0.01:
                self._wind_force = 0.0

        force = control_force + (WIND_CART_COUPLING * self._wind_force)
        sin_theta = math.sin(self._theta)
        cos_theta = math.cos(self._theta)

        temp = (force + POLE_MASS_LENGTH * self._theta_dot * self._theta_dot * sin_theta - CART_LINEAR_DRAG * self._x_dot) / TOTAL_MASS
        theta_acc = (
            GRAVITY * sin_theta
            - cos_theta * temp
            - POLE_ANGULAR_DAMPING * self._theta_dot
            + self._wind_pole_coupling * self._wind_force
        ) / (HALF_POLE_LENGTH * (4.0 / 3.0 - (MASS_POLE * cos_theta * cos_theta) / TOTAL_MASS))
        x_acc = temp - (POLE_MASS_LENGTH * theta_acc * cos_theta) / TOTAL_MASS

        self._x_dot += x_acc * SIM_DT
        self._x_dot = float(numpy.clip(self._x_dot, -MAX_SPEED, MAX_SPEED))
        self._x += self._x_dot * SIM_DT
        self._theta_dot += theta_acc * SIM_DT
        self._theta += self._theta_dot * SIM_DT

        if self._x < -self._track_half_length:
            self._x = -self._track_half_length
            if self._x_dot < 0.0:
                self._x_dot = -self._x_dot * CART_BOUNCE_RESTITUTION
            wall_hit = True
        elif self._x > self._track_half_length:
            self._x = self._track_half_length
            if self._x_dot > 0.0:
                self._x_dot = -self._x_dot * CART_BOUNCE_RESTITUTION
            wall_hit = True

        self._step_count += 1
        if wall_hit:
            self._wall_hit_count += 1
        terminated = bool(self._wall_hit_count >= MAX_WALL_HITS_PER_EPISODE)
        truncated = bool(self._step_count >= MAX_STEPS_PER_EPISODE)

        action_val = float(numpy.clip(action[0], -1.0, 1.0))
        upright = (math.cos(self._theta) + 1.0) / 2.0
        x_norm = abs(self._x / self._track_half_length)
        centered = max(0.0, 1.0 - x_norm)
        small_velocity = 1.0 / (1.0 + (self._theta_dot / 5.0) ** 2)
        small_control = 1.0 / (1.0 + (abs(action_val) / 1.0) ** 2)
        reward = upright * centered * small_velocity * small_control

        info = {
            "reward_upright": upright,
            "reward_centered": centered,
            "reward_small_velocity": small_velocity,
            "reward_small_control": small_control,
            "reward": reward,
            "reward_steps": 1,
            "wall_hits": self._wall_hit_count,
        }
        return self._get_obs(), float(reward), terminated, truncated, info

    def _get_obs(self):
        track_len = self._track_half_length * 2.0
        left_norm = (self._x + self._track_half_length) / track_len
        right_norm = (self._track_half_length - self._x) / track_len
        x_dot_norm = self._x_dot / MAX_SPEED
        sin_theta = math.sin(self._theta)
        cos_theta = math.cos(self._theta)
        theta_dot_norm = self._theta_dot / THETA_DOT_REF
        wind_norm = self._wind_force / FORCE_MAG
        return numpy.array(
            [left_norm, right_norm, x_dot_norm, sin_theta, cos_theta, theta_dot_norm, wind_norm],
            dtype=numpy.float32,
        )


def export_policy_payload(model: stable_baselines3.SAC):
    state_dict = model.policy.actor.state_dict()
    payload = {
        "w1": state_dict["latent_pi.0.weight"].detach().cpu().numpy().tolist(),
        "b1": state_dict["latent_pi.0.bias"].detach().cpu().numpy().tolist(),
        "w2": state_dict["latent_pi.2.weight"].detach().cpu().numpy().tolist(),
        "b2": state_dict["latent_pi.2.bias"].detach().cpu().numpy().tolist(),
        "w3": state_dict["mu.weight"].detach().cpu().numpy().tolist(),
        "b3": state_dict["mu.bias"].detach().cpu().numpy().tolist(),
    }
    return payload


if __name__ == "__main__":
    main()
