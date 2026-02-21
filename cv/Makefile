.PHONY: all clean

all: cv.pdf

cv.pdf: cv.tex
	pdflatex -interaction=nonstopmode cv.tex

clean:
	rm -f *.aux *.log *.out *.pdf
