/* eslint-disable no-console */

class Trial {
  constructor(index, weightsCount) {
    this.index = index;
    this.weightsCount = weightsCount;

    this.totalMassKg = null;
    this.normalForceN = null;
    this.frictionForceN = null;
    this.mu = null;
    this.done = false;
  }

  setMeasurements({ totalMassKg, normalForceN, frictionForceN }) {
    this.totalMassKg = totalMassKg;
    this.normalForceN = normalForceN;
    this.frictionForceN = frictionForceN;

    this.mu = frictionForceN / normalForceN;
    this.done = true;
  }
}

class FrictionExperiment {
  constructor() {
    this.g = 9.81;

    // "Справжній" коефіцієнт тертя (дерево по дереву) для симуляції
    // (користувачу не показуємо, він бачить лише "виміри")
    this._muTrue = this._randomInRange(0.25, 0.45);

    this.blockMassKg = 0.5;
    this.weightMassKg = 0.2;
    this.noisePercent = 3;

    this.trials = [0, 1, 2, 3].map((w, i) => new Trial(i + 1, w));
  }

  updateSettings({ blockMassKg, weightMassKg, noisePercent }) {
    this.blockMassKg = this._clamp(blockMassKg, 0.05, 5);
    this.weightMassKg = this._clamp(weightMassKg, 0.01, 2);
    this.noisePercent = this._clamp(noisePercent, 0, 20);
  }

  measureBlockWeightN() {
    // “Вага бруска” = m*g (+ шум)
    const ideal = this.blockMassKg * this.g;
    return this._applyNoise(ideal);
  }

  measureFrictionForWeights(weightsCount) {
    // N = (m_block + m_weights)*g
    const totalMass = this.blockMassKg + weightsCount * this.weightMassKg;
    const normal = totalMass * this.g;

    // F = mu_true * N (+ шум)
    const idealF = this._muTrue * normal;

    return {
      totalMassKg: totalMass,
      normalForceN: this._applyNoise(normal),
      frictionForceN: this._applyNoise(idealF),
    };
  }

  autoFillAllTrials() {
    for (const t of this.trials) {
      const m = this.measureFrictionForWeights(t.weightsCount);
      t.setMeasurements(m);
    }
  }

  reset() {
    this._muTrue = this._randomInRange(0.25, 0.45);
    this.trials = [0, 1, 2, 3].map((w, i) => new Trial(i + 1, w));
  }

  get doneCount() {
    return this.trials.filter((t) => t.done).length;
  }

  get muAverage() {
    const done = this.trials.filter((t) => t.done);
    if (done.length === 0) return null;
    const sum = done.reduce((acc, t) => acc + t.mu, 0);
    return sum / done.length;
  }

  exportJson() {
    return {
      settings: {
        g: this.g,
        blockMassKg: this.blockMassKg,
        weightMassKg: this.weightMassKg,
        noisePercent: this.noisePercent,
      },
      results: this.trials.map((t) => ({
        trial: t.index,
        weightsCount: t.weightsCount,
        totalMassKg: t.totalMassKg,
        normalForceN: t.normalForceN,
        frictionForceN: t.frictionForceN,
        mu: t.mu,
        done: t.done,
      })),
    };
  }

  _applyNoise(value) {
    const p = this.noisePercent / 100;
    if (p === 0) return value;
    const delta = value * p;
    const noisy = value + this._randomInRange(-delta, delta);
    return Math.max(0, noisy);
  }

  _randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  _clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
}

class ExperimentUI {
  constructor(exp) {
    this.exp = exp;

    this.el = {
      blockMass: document.getElementById("blockMass"),
      weightMass: document.getElementById("weightMass"),
      noise: document.getElementById("noise"),

      btnMeasureWeight: document.getElementById("btnMeasureWeight"),
      btnMeasureFriction: document.getElementById("btnMeasureFriction"),
      btnReset: document.getElementById("btnReset"),
      btnFillAuto: document.getElementById("btnFillAuto"),
      btnExportJson: document.getElementById("btnExportJson"),

      weightReading: document.getElementById("weightReading"),
      frictionReading: document.getElementById("frictionReading"),

      badgeStatus: document.getElementById("badgeStatus"),
      resultsBody: document.getElementById("resultsBody"),

      muAvg: document.getElementById("muAvg"),
      doneCount: document.getElementById("doneCount"),

      exportBox: document.getElementById("exportBox"),
      segmentedButtons: Array.from(document.querySelectorAll(".segmented__btn")),
    };

    this.selectedWeights = 0;

    this._bind();
    this._render();
  }

  _bind() {
    const onSettingsChange = () => {
      this.exp.updateSettings({
        blockMassKg: Number(this.el.blockMass.value),
        weightMassKg: Number(this.el.weightMass.value),
        noisePercent: Number(this.el.noise.value),
      });
      this._setStatus("Налаштування оновлено");
      this._render();
    };

    this.el.blockMass.addEventListener("input", onSettingsChange);
    this.el.weightMass.addEventListener("input", onSettingsChange);
    this.el.noise.addEventListener("input", onSettingsChange);

    this.el.segmentedButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.el.segmentedButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        this.selectedWeights = Number(btn.dataset.w);
        this._setStatus(`Обрано тягарців: ${this.selectedWeights}`);
      });
    });

    this.el.btnMeasureWeight.addEventListener("click", () => {
      const reading = this.exp.measureBlockWeightN();
      this.el.weightReading.textContent = this._fmt(reading, 2);
      this._setStatus("Вагу бруска виміряно");
    });

    this.el.btnMeasureFriction.addEventListener("click", () => {
      const trial = this.exp.trials.find((t) => t.weightsCount === this.selectedWeights);
      if (!trial) return;

      const m = this.exp.measureFrictionForWeights(this.selectedWeights);
      trial.setMeasurements(m);

      this.el.frictionReading.textContent = this._fmt(m.frictionForceN, 2);
      this._setStatus(`Дослід №${trial.index} виконано`);
      this._render();
    });

    this.el.btnFillAuto.addEventListener("click", () => {
      this.exp.autoFillAllTrials();
      this._setStatus("Автозаповнення виконано");
      this._render();
    });

    this.el.btnExportJson.addEventListener("click", () => {
      const data = this.exp.exportJson();
      this.el.exportBox.hidden = false;
      this.el.exportBox.textContent = JSON.stringify(data, null, 2);
      this._setStatus("Експортовано JSON");
    });

    this.el.btnReset.addEventListener("click", () => {
      this.exp.reset();
      this.el.weightReading.textContent = "—";
      this.el.frictionReading.textContent = "—";
      this.el.exportBox.hidden = true;
      this.el.exportBox.textContent = "";
      this._setStatus("Скинуто. Можна починати знову");
      this._render();
    });
  }

  _render() {
    this.el.resultsBody.innerHTML = this.exp.trials
      .map((t) => {
        const totalMass = t.done ? this._fmt(t.totalMassKg, 2) : "—";
        const normal = t.done ? this._fmt(t.normalForceN, 2) : "—";
        const friction = t.done ? this._fmt(t.frictionForceN, 2) : "—";
        const mu = t.done ? this._fmt(t.mu, 3) : "—";

        return `
          <tr>
            <td>${t.index}</td>
            <td>${t.weightsCount}</td>
            <td>${totalMass}</td>
            <td>${normal}</td>
            <td>${friction}</td>
            <td><strong>${mu}</strong></td>
          </tr>
        `;
      })
      .join("");

    const avg = this.exp.muAverage;
    this.el.muAvg.textContent = avg === null ? "—" : this._fmt(avg, 3);
    this.el.doneCount.textContent = `${this.exp.doneCount}/4`;

    if (this.exp.doneCount === 4) {
      this.el.badgeStatus.textContent = "Завершено (4/4)";
    }
  }

  _setStatus(text) {
    this.el.badgeStatus.textContent = text;
  }

  _fmt(value, digits) {
    return Number(value).toFixed(digits);
  }
}

// старт
document.addEventListener("DOMContentLoaded", () => {
  const exp = new FrictionExperiment();
  new ExperimentUI(exp);
});
