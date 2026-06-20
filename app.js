/* ============================================
   DIE-CASTING CYLINDER SELECTION CALCULATOR
   Core Calculation Engine & UI Logic
   ============================================ */

// --- Material Properties Database ---
const MATERIALS = {
    aluminum:  { name: 'Aluminum',  symbol: 'Al', density: 2.70, meltingPt: 660, pouringMin: 640, pouringMax: 710, specPressMin: 300, specPressMax: 600, machineType: 'Cold Chamber' },
    zinc:      { name: 'Zinc',      symbol: 'Zn', density: 6.60, meltingPt: 419, pouringMin: 400, pouringMax: 430, specPressMin: 150, specPressMax: 350, machineType: 'Hot Chamber' },
    magnesium: { name: 'Magnesium', symbol: 'Mg', density: 1.74, meltingPt: 650, pouringMin: 640, pouringMax: 700, specPressMin: 300, specPressMax: 500, machineType: 'Cold / Hot Chamber' },
    copper:    { name: 'Copper',    symbol: 'Cu', density: 8.96, meltingPt: 1085, pouringMin: 950, pouringMax: 1050, specPressMin: 400, specPressMax: 700, machineType: 'Cold Chamber' },
    lead:      { name: 'Lead',      symbol: 'Pb', density: 11.34, meltingPt: 327, pouringMin: 300, pouringMax: 350, specPressMin: 100, specPressMax: 250, machineType: 'Hot Chamber' },
    tin:       { name: 'Tin',       symbol: 'Sn', density: 7.30, meltingPt: 232, pouringMin: 240, pouringMax: 280, specPressMin: 100, specPressMax: 200, machineType: 'Hot Chamber' },
};

// --- Standard Machine Tonnage Ratings ---
const STANDARD_TONNAGES = [80, 125, 160, 200, 250, 280, 350, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3000, 4000];

// --- Utility Helpers ---
function getVal(id) {
    const v = parseFloat(document.getElementById(id).value);
    return isNaN(v) ? 0 : v;
}

function fmt(num, decimals = 2) {
    if (num === Infinity || num === -Infinity || isNaN(num)) return '—';
    return Number(num).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// --- Main Calculation ---
function calculate() {
    // Gather inputs
    const materialKey = document.getElementById('material').value;
    const machineType = document.getElementById('machineType').value;
    const castingArea = getVal('castingArea');
    const numCavities = getVal('numCavities') || 1;
    const runnerArea = getVal('runnerArea');
    const shotWeight = getVal('shotWeight');
    const plungerDia = getVal('plungerDiameter');
    const plungerStroke = getVal('plungerStroke');
    const hydraulicPressure = getVal('hydraulicPressure');
    const intensificationRatio = getVal('intensificationRatio') || 10;
    const gateArea = getVal('gateArea');
    const fillTime = getVal('fillTime');
    const specificPressure = getVal('specificPressure');
    const safetyFactor = getVal('safetyFactor') || 1.2;

    const mat = MATERIALS[materialKey];

    // Validation: need at least casting area and plunger diameter
    if (castingArea <= 0 && plungerDia <= 0 && shotWeight <= 0) {
        document.getElementById('results-section').style.display = 'none';
        return;
    }

    // ==================== CALCULATIONS ====================

    // 1. Total Projected Area (cm²)
    const totalProjectedArea = (castingArea * numCavities) + runnerArea;

    // 2. Required Clamping Force (Tons)
    //    Clamping Force = Total Projected Area × Specific Pressure / 1000
    const specPress = specificPressure > 0 ? specificPressure : ((mat.specPressMin + mat.specPressMax) / 2);
    const requiredClampingForce = (totalProjectedArea * specPress) / 1000; // in Tons
    const requiredClampingWithSafety = requiredClampingForce * safetyFactor;

    // 3. Plunger Cross-Section Area (cm²)
    const plungerDiaCm = plungerDia / 10; // mm to cm
    const plungerArea = Math.PI * Math.pow(plungerDiaCm / 2, 2); // cm²
    const plungerAreaMM2 = Math.PI * Math.pow(plungerDia / 2, 2); // mm²

    // 4. Plunger Volume / Cylinder Capacity (cm³)
    const plungerStrokeCm = plungerStroke / 10;
    const cylinderCapacity = plungerArea * plungerStrokeCm; // cm³

    // 5. Shot Volume (cm³)
    const shotVolume = mat.density > 0 ? (shotWeight / mat.density) : 0; // cm³

    // 6. Fill Ratio (%)
    const fillRatio = cylinderCapacity > 0 ? (shotVolume / cylinderCapacity) * 100 : 0;

    // 7. Metal Pressure (kg/cm²) - Pressure on the metal inside the die
    //    Metal Pressure = Hydraulic Pressure × Intensification Ratio
    const metalPressure = hydraulicPressure * intensificationRatio;

    // 8. Injection Force (Tons)
    //    Injection Force = Metal Pressure × Plunger Area / 1000
    const injectionForce = (metalPressure * plungerArea) / 1000;

    // 9. Gate Velocity (m/s)
    //    Gate Velocity = Shot Volume / (Gate Area × Fill Time)
    //    Convert: Shot Volume cm³ = cm³, Gate Area mm² → cm², Fill Time sec
    const gateAreaCm2 = gateArea / 100; // mm² to cm²
    let gateVelocity = 0;
    if (gateAreaCm2 > 0 && fillTime > 0) {
        gateVelocity = (shotVolume / (gateAreaCm2 * fillTime)) / 100; // cm/s → m/s
    }

    // 10. Plunger Velocity (m/s)
    //     Plunger Velocity = Shot Volume / (Plunger Area × Fill Time)
    let plungerVelocity = 0;
    if (plungerArea > 0 && fillTime > 0) {
        plungerVelocity = (shotVolume / (plungerArea * fillTime)) / 100; // cm/s → m/s
    }

    // 11. Casting Weight (per cavity) (grams)
    const castingWeightPerCavity = numCavities > 0 ? (shotWeight / numCavities) : shotWeight;

    // 12. PQ² Ratio (Gate Area / Plunger Area)
    const pq2Ratio = plungerAreaMM2 > 0 ? (gateArea / plungerAreaMM2) : 0;

    // 13. Maximum Casting Area for Given Tonnage
    //     Max Area = (Clamping Force × 1000) / Specific Pressure
    const recommendedTonnage = findRecommendedTonnage(requiredClampingWithSafety);
    const maxCastingArea = specPress > 0 ? (recommendedTonnage * 1000) / specPress : 0;

    // ==================== RENDER RESULTS ====================
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = '';

    // Summary Cards
    renderSummaryCards(requiredClampingWithSafety, recommendedTonnage, fillRatio, metalPressure);

    // Detailed Table
    renderResultsTable({
        totalProjectedArea,
        requiredClampingForce,
        requiredClampingWithSafety,
        plungerArea,
        plungerAreaMM2,
        cylinderCapacity,
        shotVolume,
        fillRatio,
        metalPressure,
        injectionForce,
        gateVelocity,
        plungerVelocity,
        castingWeightPerCavity,
        pq2Ratio,
        maxCastingArea,
        specPress,
        mat,
        numCavities,
        safetyFactor
    });

    // Recommendation
    renderRecommendation(requiredClampingWithSafety, recommendedTonnage, fillRatio, mat);

    // Gauge
    renderGauge(fillRatio);

    // Highlight matching tonnage chip
    highlightTonnage(recommendedTonnage);

    // Smooth scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// --- Find Recommended Standard Tonnage ---
function findRecommendedTonnage(requiredTonnage) {
    if (requiredTonnage <= 0) return STANDARD_TONNAGES[0];
    for (let i = 0; i < STANDARD_TONNAGES.length; i++) {
        if (STANDARD_TONNAGES[i] >= requiredTonnage) {
            return STANDARD_TONNAGES[i];
        }
    }
    return STANDARD_TONNAGES[STANDARD_TONNAGES.length - 1];
}

// --- Render Summary Cards ---
function renderSummaryCards(clampingForce, recommendedTonnage, fillRatio, metalPressure) {
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = `
        <div class="summary-card blue">
            <div class="label">Required Clamping Force</div>
            <div class="value">${fmt(clampingForce, 1)}<span class="val-unit">Tons</span></div>
        </div>
        <div class="summary-card green">
            <div class="label">Recommended Machine</div>
            <div class="value">${recommendedTonnage > 0 ? recommendedTonnage : '—'}<span class="val-unit">Tons</span></div>
        </div>
        <div class="summary-card purple">
            <div class="label">Fill Ratio</div>
            <div class="value">${fillRatio > 0 ? fmt(fillRatio, 1) : '—'}<span class="val-unit">%</span></div>
        </div>
        <div class="summary-card orange">
            <div class="label">Metal Pressure</div>
            <div class="value">${metalPressure > 0 ? fmt(metalPressure, 0) : '—'}<span class="val-unit">kg/cm²</span></div>
        </div>
    `;
}

// --- Render Results Table ---
function renderResultsTable(r) {
    const tbody = document.getElementById('resultsBody');
    const rows = [
        { label: 'Casting Material', value: r.mat.name + ` (${r.mat.symbol})`, unit: '—', status: 'info', statusText: r.mat.machineType },
        { label: 'Material Density', value: fmt(r.mat.density, 2), unit: 'g/cm³', status: 'info', statusText: 'Reference' },
        { label: 'Number of Cavities', value: r.numCavities, unit: '—', status: 'info', statusText: 'Input' },
        { label: 'Total Projected Area', value: fmt(r.totalProjectedArea, 2), unit: 'cm²', status: r.totalProjectedArea > 0 ? 'ok' : 'warn', statusText: r.totalProjectedArea > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Specific Pressure Used', value: fmt(r.specPress, 0), unit: 'kg/cm²', status: 'info', statusText: 'Applied' },
        { label: 'Safety Factor', value: fmt(r.safetyFactor, 2), unit: '×', status: 'info', statusText: 'Applied' },
        { label: 'Required Clamping Force (w/o Safety)', value: fmt(r.requiredClampingForce, 1), unit: 'Tons', status: 'ok', statusText: 'Calculated' },
        { label: 'Required Clamping Force (with Safety)', value: fmt(r.requiredClampingWithSafety, 1), unit: 'Tons', status: 'ok', statusText: 'Final' },
        { label: 'Plunger Cross-Section Area', value: fmt(r.plungerAreaMM2, 2), unit: 'mm²', status: r.plungerAreaMM2 > 0 ? 'ok' : 'warn', statusText: r.plungerAreaMM2 > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Cylinder Capacity', value: fmt(r.cylinderCapacity, 2), unit: 'cm³', status: r.cylinderCapacity > 0 ? 'ok' : 'warn', statusText: r.cylinderCapacity > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Shot Volume', value: fmt(r.shotVolume, 2), unit: 'cm³', status: r.shotVolume > 0 ? 'ok' : 'warn', statusText: r.shotVolume > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Fill Ratio', value: r.fillRatio > 0 ? fmt(r.fillRatio, 1) : '—', unit: '%', status: getFillStatus(r.fillRatio), statusText: getFillText(r.fillRatio) },
        { label: 'Metal Pressure', value: r.metalPressure > 0 ? fmt(r.metalPressure, 0) : '—', unit: 'kg/cm²', status: r.metalPressure > 0 ? 'ok' : 'warn', statusText: r.metalPressure > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Injection Force', value: r.injectionForce > 0 ? fmt(r.injectionForce, 2) : '—', unit: 'Tons', status: r.injectionForce > 0 ? 'ok' : 'warn', statusText: r.injectionForce > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Gate Velocity', value: r.gateVelocity > 0 ? fmt(r.gateVelocity, 2) : '—', unit: 'm/s', status: getGateVelStatus(r.gateVelocity), statusText: getGateVelText(r.gateVelocity) },
        { label: 'Plunger Velocity (Slow Shot)', value: r.plungerVelocity > 0 ? fmt(r.plungerVelocity, 3) : '—', unit: 'm/s', status: r.plungerVelocity > 0 ? 'ok' : 'warn', statusText: r.plungerVelocity > 0 ? 'Calculated' : 'Enter Data' },
        { label: 'Casting Weight / Cavity', value: r.castingWeightPerCavity > 0 ? fmt(r.castingWeightPerCavity, 1) : '—', unit: 'grams', status: 'info', statusText: 'Per Cavity' },
        { label: 'PQ² Ratio (Gate/Plunger Area)', value: r.pq2Ratio > 0 ? fmt(r.pq2Ratio, 4) : '—', unit: 'ratio', status: 'info', statusText: 'Reference' },
        { label: 'Max Casting Area for Machine', value: r.maxCastingArea > 0 ? fmt(r.maxCastingArea, 1) : '—', unit: 'cm²', status: 'info', statusText: 'Limit' },
    ];

    tbody.innerHTML = rows.map(row => `
        <tr>
            <td>${row.label}</td>
            <td>${row.value}</td>
            <td>${row.unit}</td>
            <td><span class="status-badge ${row.status}">${row.statusText}</span></td>
        </tr>
    `).join('');
}

// --- Fill Ratio Helpers ---
function getFillStatus(ratio) {
    if (ratio <= 0) return 'warn';
    if (ratio >= 30 && ratio <= 60) return 'ok';
    if (ratio > 60 && ratio <= 75) return 'warn';
    if (ratio > 75) return 'danger';
    return 'warn';
}
function getFillText(ratio) {
    if (ratio <= 0) return 'Enter Data';
    if (ratio >= 30 && ratio <= 60) return 'Optimal';
    if (ratio > 60 && ratio <= 75) return 'High';
    if (ratio > 75) return 'Too High';
    if (ratio < 30 && ratio > 0) return 'Low';
    return 'Check';
}

// --- Gate Velocity Helpers ---
function getGateVelStatus(vel) {
    if (vel <= 0) return 'warn';
    if (vel >= 20 && vel <= 60) return 'ok';
    if (vel > 60) return 'danger';
    return 'warn';
}
function getGateVelText(vel) {
    if (vel <= 0) return 'Enter Data';
    if (vel >= 20 && vel <= 60) return 'Optimal';
    if (vel > 60) return 'Too High';
    if (vel < 20) return 'Low';
    return 'Check';
}

// --- Render Recommendation ---
function renderRecommendation(requiredTonnage, recommendedTonnage, fillRatio, mat) {
    const box = document.getElementById('recommendationBox');
    const isWarning = fillRatio > 75;
    const utilizationPct = recommendedTonnage > 0 ? ((requiredTonnage / recommendedTonnage) * 100).toFixed(1) : 0;

    let fillAdvice = '';
    if (fillRatio > 0) {
        if (fillRatio >= 30 && fillRatio <= 60) {
            fillAdvice = `Fill ratio of <span class="highlight">${fmt(fillRatio, 1)}%</span> is within the optimal range (30–60%).`;
        } else if (fillRatio > 60 && fillRatio <= 75) {
            fillAdvice = `Fill ratio of <span class="highlight-warn">${fmt(fillRatio, 1)}%</span> is slightly high. Consider a larger cylinder.`;
        } else if (fillRatio > 75) {
            fillAdvice = `Fill ratio of <span class="highlight-warn">${fmt(fillRatio, 1)}%</span> is too high! Use a larger plunger/cylinder.`;
        } else {
            fillAdvice = `Fill ratio of <span class="highlight-warn">${fmt(fillRatio, 1)}%</span> is low. Consider a smaller cylinder for efficiency.`;
        }
    }

    box.className = 'recommendation-box' + (isWarning ? ' warning' : '');
    box.innerHTML = `
        <div class="rec-icon ${isWarning ? 'warn' : 'ok'}">
            ${isWarning ? '⚠️' : '✅'}
        </div>
        <div class="rec-content">
            <h3>${isWarning ? 'Review Required' : 'Recommended Configuration'}</h3>
            <p>
                For <strong>${mat.name}</strong> die-casting, the recommended machine is 
                <span class="highlight">${recommendedTonnage} Tons</span> 
                (${mat.machineType}).
                Machine utilization: <span class="highlight">${utilizationPct}%</span>.
                ${fillAdvice ? '<br>' + fillAdvice : ''}
                <br>Recommended specific pressure range: 
                <span class="highlight">${mat.specPressMin}–${mat.specPressMax} kg/cm²</span>.
                Pouring temperature: 
                <span class="highlight">${mat.pouringMin}–${mat.pouringMax} °C</span>.
            </p>
        </div>
    `;
}

// --- Render Fill Ratio Gauge ---
function renderGauge(fillRatio) {
    const container = document.getElementById('gaugeContainer');
    const clampedRatio = Math.min(Math.max(fillRatio, 0), 100);
    let statusClass = 'ok';
    if (fillRatio > 60 && fillRatio <= 75) statusClass = 'warn';
    if (fillRatio > 75) statusClass = 'danger';
    if (fillRatio < 30 && fillRatio > 0) statusClass = 'warn';

    container.innerHTML = `
        <div class="gauge-bar-wrapper">
            <div class="gauge-labels">
                <span>0%</span>
                <span style="color: var(--accent-green);">30% — Optimal — 60%</span>
                <span>100%</span>
            </div>
            <div class="gauge-bar">
                <div class="gauge-fill ${statusClass}" style="width: ${clampedRatio}%;"></div>
            </div>
        </div>
        <div class="gauge-value ${statusClass}">
            ${fillRatio > 0 ? fmt(fillRatio, 1) : '—'}<span class="g-unit">%</span>
        </div>
    `;
}

// --- Highlight Matching Tonnage Chip ---
function highlightTonnage(tonnage) {
    const chips = document.querySelectorAll('.tonnage-chip');
    chips.forEach(chip => {
        const chipVal = parseInt(chip.textContent);
        chip.classList.toggle('active', chipVal === tonnage);
    });
}

// --- Reset All Fields ---
function resetAll() {
    const fields = ['castingArea', 'runnerArea', 'shotWeight', 'plungerDiameter', 'plungerStroke',
                    'hydraulicPressure', 'gateArea', 'fillTime', 'specificPressure'];
    fields.forEach(id => document.getElementById(id).value = '');
    document.getElementById('numCavities').value = '1';
    document.getElementById('intensificationRatio').value = '10';
    document.getElementById('safetyFactor').value = '1.2';
    document.getElementById('material').value = 'aluminum';
    document.getElementById('machineType').value = 'coldChamber';
    document.getElementById('results-section').style.display = 'none';

    // Reset tonnage chips
    document.querySelectorAll('.tonnage-chip').forEach(c => c.classList.remove('active'));

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Handle Enter Key in Inputs ---
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        e.preventDefault();
        calculate();
    }
});

// --- Add Input Ripple Effect ---
document.querySelectorAll('.input-group input, .input-group select').forEach(el => {
    el.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    el.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
});

// --- Init: Add Stagger Animations ---
document.addEventListener('DOMContentLoaded', () => {
    // Add intersection observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animationPlayState = 'running';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.animate-in').forEach(el => {
        observer.observe(el);
    });
});
