import { useEffect, useRef } from "react";
import "./App.css";
import headshotImage from "../real_headshot.png";
import cartPolePolicy from "./assets/cartpole_policy.json";
import cartPoleConfig from "../config/cartpole_config.json";

function App() {
  const stageRef = useRef(null);
  const headshotRef = useRef(null);
  const glowRef = useRef(null);
  const citySkyRef = useRef(null);
  const cityFarRef = useRef(null);
  const cityMidRef = useRef(null);
  const cityNearRef = useRef(null);
  const cityHazeRef = useRef(null);
  const cartZoneRef = useRef(null);
  const cartRef = useRef(null);
  const pendulumRef = useRef(null);

  useEffect(() => {
    const stage = stageRef.current;
    const headshot = headshotRef.current;
    const glow = glowRef.current;
    const citySky = citySkyRef.current;
    const cityFar = cityFarRef.current;
    const cityMid = cityMidRef.current;
    const cityNear = cityNearRef.current;
    const cityHaze = cityHazeRef.current;
    if (!stage || !headshot || !glow || !citySky || !cityFar || !cityMid || !cityNear || !cityHaze) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isCoarsePointer = window.matchMedia("(pointer: coarse)");
    const themes = ["theme-forest", "theme-desert", "theme-snow"];
    let themeIndex = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let rafPending = false;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const addMediaQueryChangeListener = (mediaQueryList, handler) => {
      if (typeof mediaQueryList.addEventListener === "function") {
        mediaQueryList.addEventListener("change", handler);
        return;
      }
      if (typeof mediaQueryList.addListener === "function") {
        mediaQueryList.addListener(handler);
        return;
      }
      throw new Error("MediaQueryList change listeners are not supported in this browser.");
    };

    const removeMediaQueryChangeListener = (mediaQueryList, handler) => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", handler);
        return;
      }
      if (typeof mediaQueryList.removeListener === "function") {
        mediaQueryList.removeListener(handler);
      }
    };

    const resetTransforms = () => {
      stage.style.transform = "rotateX(0deg) rotateY(0deg)";
      headshot.style.transform = "translate3d(0px, 0px, 24px) rotateX(0deg) rotateY(0deg)";
      glow.style.transform = "translate3d(0px, 0px, 0px)";
      glow.style.opacity = "0.8";
      citySky.style.transform = "translate3d(0px, 0px, 0px)";
      cityFar.style.transform = "translate3d(0px, 0px, 0px)";
      cityMid.style.transform = "translate3d(0px, 0px, 0px)";
      cityNear.style.transform = "translate3d(0px, 0px, 0px)";
      cityHaze.style.transform = "translate3d(0px, 0px, 0px)";
    };

    const applyTheme = () => {
      for (const themeName of themes) {
        stage.classList.remove(themeName);
      }
      stage.classList.add(themes[themeIndex]);
    };

    const requestUpdate = () => {
      if (!rafPending) {
        rafPending = true;
        window.requestAnimationFrame(updateParallax);
      }
    };

    const cycleTheme = () => {
      themeIndex = (themeIndex + 1) % themes.length;
      applyTheme();
      requestUpdate();
    };

    const updateParallax = () => {
      rafPending = false;
      if (prefersReducedMotion.matches) {
        resetTransforms();
        return;
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const scrollNorm = maxScroll > 0 ? (window.scrollY / maxScroll) * 2 - 1 : 0;
      const rect = stage.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const cursorX = isCoarsePointer.matches ? centerX : pointerX;
      const cursorY = isCoarsePointer.matches ? centerY : pointerY;

      const normalizedX = clamp((cursorX - centerX) / (window.innerWidth * 0.45), -1, 1);
      const normalizedY = clamp((cursorY - centerY) / (window.innerHeight * 0.45), -1, 1);

      const rotateX = (-normalizedY * 12) + (scrollNorm * 4);
      const rotateY = (normalizedX * 15) + (scrollNorm * -2);
      const translateX = normalizedX * 3.5;
      const translateY = (normalizedY * 2.5) - (scrollNorm * 2.25);
      const depth = 24 + Math.abs(normalizedX) * 1.75 + Math.abs(normalizedY) * 1.25;
      const glowX = normalizedX * 16;
      const glowY = normalizedY * 12;
      const skyX = normalizedX * -4;
      const skyY = (normalizedY * -2) - (scrollNorm * 2);
      const farX = normalizedX * -7;
      const farY = (normalizedY * -3) - (scrollNorm * 3.5);
      const midX = normalizedX * -10;
      const midY = (normalizedY * -5) - (scrollNorm * 5.5);
      const nearX = normalizedX * -14;
      const nearY = (normalizedY * -7) - (scrollNorm * 8);

      stage.style.transform = `rotateX(${rotateX * 0.18}deg) rotateY(${rotateY * 0.14}deg)`;
      headshot.style.transform = `translate3d(${translateX}px, ${translateY}px, ${depth}px) rotateX(${rotateX * 0.25}deg) rotateY(${rotateY * 0.25}deg)`;
      headshot.style.filter = `drop-shadow(${-translateX * 0.5}px ${12 + Math.abs(translateY)}px 18px rgba(0, 0, 0, 0.22))`;
      glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0px)`;
      glow.style.opacity = String(0.72 + (1 - Math.min(1, Math.abs(scrollNorm))) * 0.2);
      citySky.style.transform = `translate3d(${skyX}px, ${skyY}px, 0px)`;
      cityFar.style.transform = `translate3d(${farX}px, ${farY}px, 0px)`;
      cityMid.style.transform = `translate3d(${midX}px, ${midY}px, 0px)`;
      cityNear.style.transform = `translate3d(${nearX}px, ${nearY}px, 0px)`;
      cityHaze.style.transform = `translate3d(${nearX * 0.65}px, ${nearY * 0.55}px, 0px)`;
    };

    const onMouseMove = (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      requestUpdate();
    };

    const onThemeKeyDown = (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      cycleTheme();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    addMediaQueryChangeListener(prefersReducedMotion, requestUpdate);
    addMediaQueryChangeListener(isCoarsePointer, requestUpdate);
    stage.addEventListener("click", cycleTheme);
    stage.addEventListener("keydown", onThemeKeyDown);

    applyTheme();
    requestUpdate();

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      removeMediaQueryChangeListener(prefersReducedMotion, requestUpdate);
      removeMediaQueryChangeListener(isCoarsePointer, requestUpdate);
      stage.removeEventListener("click", cycleTheme);
      stage.removeEventListener("keydown", onThemeKeyDown);
    };
  }, []);

  useEffect(() => {
    const cartZone = cartZoneRef.current;
    const cart = cartRef.current;
    const pendulum = pendulumRef.current;
    if (!cartZone || !cart) {
      return undefined;
    }

    const cartWidth = 30;
    let x = 0;
    let xDot = 0;
    let theta = Math.random() * 2 * Math.PI - Math.PI;
    let thetaDot = 0;
    let lastTimestamp = performance.now();
    let animationFrameId = 0;
    let accumulator = 0;
    let windForce = 0;
    let windAgeSeconds = Number.POSITIVE_INFINITY;
    let lastMouseTimestamp = 0;
    let lastMouseX = 0;
    let wallHitCount = 0;

    const gravity = cartPoleConfig.gravity;
    const massCart = cartPoleConfig.massCart;
    const massPole = cartPoleConfig.massPole;
    const totalMass = massCart + massPole;
    const halfPoleLength = cartPoleConfig.halfPoleLength;
    const poleMassLength = massPole * halfPoleLength;
    const forceMag = cartPoleConfig.forceMag;
    const controlAccelerationScale = cartPoleConfig.controlAccelerationScale;
    const cartLinearDrag = cartPoleConfig.cartLinearDrag;
    const poleAngularDamping = cartPoleConfig.poleAngularDamping;
    const integrationStep = 1 / cartPoleConfig.stepsPerSecond;
    const trackHalfLength = cartPoleConfig.trackHalfLength;
    const maxSpeed = cartPoleConfig.maxSpeed;
    const windDecayPerSecond = cartPoleConfig.windDecayPerSecond;
    const windImpulseGain = 7.5;
    const maxWindForce = cartPoleConfig.maxWindForce;
    const clickWindImpulse = cartPoleConfig.clickWindForce;
    const windActiveDurationSeconds = cartPoleConfig.windActiveDurationSeconds;
    const windCartCoupling = cartPoleConfig.windCartCoupling;
    const windPoleCoupling = cartPoleConfig.windPoleCoupling;
    const cartBounceRestitution = cartPoleConfig.cartBounceRestitution;
    const thetaDotRef = cartPoleConfig.thetaDotRef ?? 4 * Math.PI;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const maxXpx = () => Math.max(0, cartZone.getBoundingClientRect().width - cartWidth);
    const metersToPixels = () => maxXpx() / (trackHalfLength * 2);
    const cartXToPixels = () => (x + trackHalfLength) * metersToPixels();
    const pendulumPivotX = () => {
      const cartRect = cart.getBoundingClientRect();
      return cartRect.left + (cartRect.width * 0.5);
    };
    const applyWindImpulse = (rawImpulse) => {
      windForce = clamp(rawImpulse, -maxWindForce, maxWindForce);
      windAgeSeconds = 0;
    };
    const updateCartDamageVisual = () => {
      const damageLevel = wallHitCount >= 2 ? 3 : wallHitCount + 1;
      cart.dataset.damageLevel = String(damageLevel);
      cart.dataset.wallHits = String(Math.min(wallHitCount, 3));
    };
    const registerWallHit = () => {
      wallHitCount += 1;
      updateCartDamageVisual();
    };

    const render = () => {
      const cartPx = cartXToPixels();
      cart.style.setProperty("--cart-x", `${cartPx}px`);
      cart.style.transform = `translateX(${cartPx}px)`;
      if (pendulum) {
        pendulum.style.transform = `rotate(${theta}rad)`;
      }
    };

    const centerCart = () => {
      x = 0;
      xDot = 0;
      render();
    };

    const shouldIgnoreKeyControls = () => {
      const active = document.activeElement;
      if (!active) {
        return false;
      }
      const tag = active.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable;
    };

    const matVecAdd = (matrix, vector, bias) => {
      const out = new Array(matrix.length);
      for (let i = 0; i < matrix.length; i += 1) {
        let sum = bias[i];
        for (let j = 0; j < vector.length; j += 1) {
          sum += matrix[i][j] * vector[j];
        }
        out[i] = sum;
      }
      return out;
    };

    const tanhVector = (vector) => vector.map((value) => Math.tanh(value));

    const policyAction = (observation) => {
      const hidden1 = tanhVector(matVecAdd(cartPolePolicy.w1, observation, cartPolePolicy.b1));
      const hidden2 = tanhVector(matVecAdd(cartPolePolicy.w2, hidden1, cartPolePolicy.b2));
      const output = matVecAdd(cartPolePolicy.w3, hidden2, cartPolePolicy.b3);
      return Math.tanh(output[0]);
    };

    const simulateStep = (dt) => {
      windAgeSeconds += dt;
      if (windAgeSeconds > windActiveDurationSeconds) {
        windForce = 0;
      } else {
        const windDecay = Math.exp(-windDecayPerSecond * dt);
        windForce *= windDecay;
        if (Math.abs(windForce) < 0.01) {
          windForce = 0;
        }
      }

      const trackLen = trackHalfLength * 2;
      const leftNorm = (x + trackHalfLength) / trackLen;
      const rightNorm = (trackHalfLength - x) / trackLen;
      const xDotNorm = xDot / maxSpeed;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const thetaDotNorm = thetaDot / thetaDotRef;
      const windNorm = windForce / forceMag;
      const observation = [leftNorm, rightNorm, xDotNorm, sinTheta, cosTheta, thetaDotNorm, windNorm];
      const action = policyAction(observation);
      const controlForce = action * forceMag * controlAccelerationScale;
      const force = controlForce + (windCartCoupling * windForce);

      const temp = (force + poleMassLength * thetaDot * thetaDot * sinTheta - cartLinearDrag * xDot) / totalMass;
      const thetaAcc = (
        gravity * sinTheta -
        cosTheta * temp -
        poleAngularDamping * thetaDot +
        (windPoleCoupling * windForce)
      ) / (halfPoleLength * (4.0 / 3.0 - (massPole * cosTheta * cosTheta) / totalMass));
      const xAcc = temp - (poleMassLength * thetaAcc * cosTheta) / totalMass;

      xDot += xAcc * dt;
      xDot = clamp(xDot, -maxSpeed, maxSpeed);
      x += xDot * dt;
      thetaDot += thetaAcc * dt;
      theta += thetaDot * dt;

      if (x < -trackHalfLength) {
        x = -trackHalfLength;
        if (xDot < 0) {
          xDot = -xDot * cartBounceRestitution;
          registerWallHit();
        }
      } else if (x > trackHalfLength) {
        x = trackHalfLength;
        if (xDot > 0) {
          xDot = -xDot * cartBounceRestitution;
          registerWallHit();
        }
      }

    };

    const simulate = (timestamp) => {
      const dt = Math.min(0.05, (timestamp - lastTimestamp) / 1000);
      lastTimestamp = timestamp;
      accumulator += dt;

      while (accumulator >= integrationStep) {
        simulateStep(integrationStep);
        accumulator -= integrationStep;
      }

      render();
      animationFrameId = window.requestAnimationFrame(simulate);
    };

    const onMouseMoveWind = (event) => {
      if (shouldIgnoreKeyControls()) {
        return;
      }
      const now = performance.now();
      if (lastMouseTimestamp === 0) {
        lastMouseTimestamp = now;
        lastMouseX = event.clientX;
        return;
      }
      const dtMs = Math.max(1, now - lastMouseTimestamp);
      const dx = event.clientX - lastMouseX;
      const velocityX = dx / dtMs;
      applyWindImpulse(velocityX * windImpulseGain);
      lastMouseTimestamp = now;
      lastMouseX = event.clientX;
    };

    const onMouseClickWind = (event) => {
      if (shouldIgnoreKeyControls()) {
        return;
      }
      const clickOffsetFromPendulum = event.clientX - pendulumPivotX();
      if (clickOffsetFromPendulum === 0) {
        return;
      }
      const impulseDirection = clickOffsetFromPendulum > 0 ? -1 : 1;
      applyWindImpulse(impulseDirection * clickWindImpulse);
    };

    const onWindowBlur = () => {
      lastMouseTimestamp = 0;
      lastMouseX = 0;
      windForce = 0;
      windAgeSeconds = Number.POSITIVE_INFINITY;
    };

    const onKeyDown = (event) => {
      if (shouldIgnoreKeyControls()) {
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }
      event.preventDefault();
    };

    const onResize = () => {
      x = clamp(x, -trackHalfLength, trackHalfLength);
      render();
    };

    window.addEventListener("mousemove", onMouseMoveWind, { passive: true });
    window.addEventListener("click", onMouseClickWind, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("resize", onResize);
    centerCart();
    updateCartDamageVisual();
    render();
    animationFrameId = window.requestAnimationFrame(simulate);

    return () => {
      window.removeEventListener("mousemove", onMouseMoveWind);
      window.removeEventListener("click", onMouseClickWind);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <main className="container">
        <div className="header">
          <div className="headshot-stage" ref={stageRef} role="button" tabIndex={0} aria-label="Change headshot background theme">
            <div className="headshot-city">
              <div className="city-layer city-sky" ref={citySkyRef}></div>
              <div className="city-layer city-far" ref={cityFarRef}></div>
              <div className="city-layer city-mid" ref={cityMidRef}></div>
              <div className="city-layer city-near" ref={cityNearRef}></div>
              <div className="city-layer city-haze" ref={cityHazeRef}></div>
            </div>
            <div className="headshot-glow" ref={glowRef}></div>
            <div className="headshot-fg-clip">
              <img className="headshot-foreground" ref={headshotRef} src={headshotImage} alt="" />
            </div>
          </div>
          <div className="header-info">
            <h1>Eric Fithian</h1>
            <div className="role">Research Professional / Predoctoral Fellow</div>
            <div className="affiliation">Center for Applied AI · University of Chicago Booth</div>
            <div className="links">
              <a href="mailto:efithian@uchicago.edu">Email</a>
              <a href="cv/cv.pdf">CV</a>
              <a href="https://github.com/Eric-Fithian">GitHub</a>
              <a href="https://scholar.google.com/citations?user=elXzya4AAAAJ&hl=en">Scholar</a>
            </div>
          </div>
        </div>

        <section>
          <h2>About</h2>
          <p>
            I&apos;m a predoctoral fellow at the Center for Applied AI at Chicago Booth. I graduated from CU Boulder in 2025 with a B.S. in Computer Science (<em>summa cum laude</em>, 4.0 GPA, graduated one year early). My work spans multimodal ML, NLP, computer vision, LLM-based data extraction, and agentic AI. I&apos;m applying to CS PhD programs for Fall 2027.
          </p>
        </section>

        <section>
          <h2>
            What I&apos;m reading about <span className="inline-muted">Feb 2026</span>
          </h2>
          <ul className="plain-list">
            <li>Latent reasoning in LLMs</li>
            <li>Adaptive neural network architectures</li>
          </ul>
        </section>

        <section>
          <h2>Research</h2>
          <div className="sub-label">Current</div>
          <ul className="plain-list">
            <li><span className="prof">Prof. Suproteem Sarkar</span> — Embedding models to investigate how stereotypes affect investment</li>
            <li><span className="prof">Prof. Rad Niazadeh</span> — Using LLMs to solve open problems in mathematics of operations research</li>
            <li><span className="prof">Prof. X.Y. Han</span> — Vision-language models for annotating neurosurgical video recordings</li>
          </ul>

          <div className="sub-label">Past</div>
          <ul className="plain-list">
            <li><span className="prof">Prof. Jacob Conway</span> — End-to-end NLP pipelines across 11M news documents to study journalist ideology</li>
            <li><span className="prof">Prof. Giovanni Compiani</span> — Pretrained embedding models for consumer choice models</li>
            <li><span className="prof">Prof. Theodora Chaspari</span> (CU Boulder) — Multimodal hirability prediction; first-authored ICMI 2025 paper</li>
          </ul>
        </section>

        <section>
          <h2>Papers</h2>
          <div className="sub-label">Published</div>
          <div className="pub-entry">
            <div className="pub-title">Leveraging Pre-Trained Transformers and Facial Embeddings for Multimodal Hirability Prediction in Job Interviews</div>
            <div className="pub-authors"><strong>Eric Fithian</strong>, Theodora Chaspari</div>
            <div className="pub-meta">ACM ICMI 2025 · Poster presented in Canberra, Australia</div>
            <div className="pub-links"><a href="https://doi.org/10.1145/3716553.3750757">Paper</a></div>
          </div>

          <div className="sub-label">Working</div>
          <div className="pub-entry">
            <div className="pub-title">DELM: A Python Toolkit for Data Extraction with Language Models</div>
            <div className="pub-authors"><strong>Eric Fithian</strong>, Kirill Skobelev</div>
            <div className="pub-meta">arXiv preprint, 2026</div>
            <div className="pub-links">
              <a href="https://arxiv.org/abs/2509.20617">Paper</a>
              <a href="https://github.com/Center-for-Applied-AI/delm">Code</a>
            </div>
          </div>

          <div className="pub-entry">
            <div className="pub-title">Do Neuron-Level Metrics Predict Beneficial Splitting in Neural Networks During Training</div>
            <div className="pub-authors"><strong>Eric Fithian</strong></div>
            <div className="pub-meta">Preprint forthcoming, 2026</div>
          </div>
        </section>

        <section>
          <h2>Software</h2>
          <p>
            <strong>DELM</strong> — Python toolkit for reproducible, scalable LLM-based structured data extraction.<br />
            <span className="software-links">
              <a href="https://github.com/Center-for-Applied-AI/delm">GitHub</a> &nbsp;
              <a href="https://pypi.org/project/delm/">PyPI</a> &nbsp;
              <a href="https://center-for-applied-ai.github.io/delm/">Docs</a>
            </span>
          </p>
        </section>

        <section>
          <h2>Education &amp; Awards</h2>
          <p>
            <strong>University of Colorado Boulder</strong>, B.S. Computer Science, 2022-2025<br />
            <em>summa cum laude</em>, 4.0 GPA, Dean&apos;s List, graduated one year early
          </p>
          <ul className="plain-list education-list">
            <li><strong>1st Place</strong>, VizWiz VQA Challenge — among ~150 graduate students, as an undergraduate (2025)</li>
            <li><strong>CU Engineering Silver Medal nominee</strong> — one CS senior nominated per year (2025)</li>
          </ul>
        </section>

        <div className="footer">Eric Fithian · Chicago, IL</div>
      </main>

      <div className="cart-zone" ref={cartZoneRef} aria-label="Cart demo">
        <div className="cart-track"></div>
        <div className="cart" ref={cartRef} aria-hidden="true">
          <div className="pendulum" ref={pendulumRef}>
            <div className="pendulum-rod"></div>
            <div className="pendulum-bob"></div>
          </div>
          <div className="cart-shatter"></div>
          <div className="cart-fragment cart-fragment-a"></div>
          <div className="cart-fragment cart-fragment-b"></div>
          <div className="cart-fragment cart-fragment-c"></div>
          <div className="cart-body"></div>
          <div className="cart-wheel cart-wheel-left"></div>
          <div className="cart-wheel cart-wheel-right"></div>
        </div>
      </div>

      <p className="cart-hint">Try moving your mouse or clicking to make Jared&apos;s life harder</p>
    </>
  );
}

export default App;
