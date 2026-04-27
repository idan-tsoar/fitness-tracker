/* ==========================================================================
   אפליקציית מעקב דיאטה - עידן
   ========================================================================== */

const STORAGE_KEY = 'idan_diet_tracker_v1';
const MEAL_OVERRIDES_KEY = 'idan_diet_meal_overrides_v1';
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MEAL_SLOTS = [
    { key: 'breakfast', label: '🌅 בוקר' },
    { key: 'snack1',    label: '🍎 חטיף ביניים' },
    { key: 'lunch',     label: '🍽️ צהריים' },
    { key: 'snack2',    label: '🥜 חטיף אחה״צ' },
    { key: 'dinner',    label: '🌙 ערב' }
];

let state = null;
let charts = {};
let activeLibraryCategory = 'lunch';
let mealOverrides = {}; // { dayIdx: { slot: { text, calories, protein } } }

/* ==================== טעינה והתחלה ==================== */
async function init() {
    state = await loadData();
    loadMealOverrides();
    applyMealOverrides();
    renderAll();
    attachEvents();
}

async function loadData() {
    let freshData = null;
    try {
        const res = await fetch('data.json');
        if (res.ok) freshData = await res.json();
    } catch (e) { console.warn('data.json fetch failed - using embedded defaults', e); }
    if (!freshData) freshData = getDefaultData();

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const saved = JSON.parse(stored);
            return {
                user: saved.user || freshData.user,
                weeks: saved.weeks || freshData.weeks,
                mealPlan: freshData.mealPlan
            };
        }
    } catch (e) { console.warn('localStorage read error', e); }

    return freshData;
}

function saveData() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.error('save error', e); }
}

function loadMealOverrides() {
    try {
        const raw = localStorage.getItem(MEAL_OVERRIDES_KEY);
        mealOverrides = raw ? JSON.parse(raw) : {};
    } catch (e) { mealOverrides = {}; }
}

function saveMealOverrides() {
    try { localStorage.setItem(MEAL_OVERRIDES_KEY, JSON.stringify(mealOverrides)); }
    catch (e) { console.error('overrides save error', e); }
}

function applyMealOverrides() {
    if (!state?.mealPlan?.days) return;
    Object.keys(mealOverrides).forEach(dayIdx => {
        const day = state.mealPlan.days[Number(dayIdx)];
        if (!day) return;
        Object.keys(mealOverrides[dayIdx]).forEach(slot => {
            const o = mealOverrides[dayIdx][slot];
            if (o && o.text) day[slot] = o.text;
        });
        // חישוב מחדש של סכום היום אחרי השינויים
        recalculateDayTotals(day);
    });
}

function recalculateDayTotals(day) {
    // מנסה לחלץ קלוריות וחלבון מהטקסט של כל ארוחה
    let cal = 0, prot = 0;
    MEAL_SLOTS.forEach(s => {
        const txt = day[s.key] || '';
        const calMatch = txt.match(/(\d+)\s*קל[׳']/);
        const protMatch = txt.match(/(\d+)\s*ג[׳']\s*(?:חלבון)?$/);
        if (calMatch) cal += Number(calMatch[1]);
        if (protMatch) prot += Number(protMatch[1]);
    });
    if (cal > 0) day.totalCalories = cal;
    if (prot > 0) day.totalProtein = prot;
}

/* ==================== ברירת מחדל מוטמעת ==================== */
function getDefaultData() {
    return {
        user: {
            name: 'עידן', age: 41, startingWeight: 83.5,
            workoutsPerWeek: 4, workoutType: 'כוח',
            dailyCalorieTarget: 2000, dailyProteinTarget: 160
        },
        weeks: [buildEmptyWeek(1, '26.04-02.05')],
        mealPlan: { shake: { name: 'שייק', ingredients: [], calories: 450, protein: 38 }, days: [], library: { breakfast:[], snacks:[], lunch:[], dinner:[] } }
    };
}

function buildEmptyWeek(num, dates) {
    return {
        weekNumber: num, dates: dates,
        days: DAY_NAMES.map(d => ({ day: d, weight: null, calories: null, protein: null, workout: false, notes: '' })),
        weeklyNotes: ''
    };
}

/* ==================== חישובי ממוצעים ==================== */
function avg(values) {
    const nums = values.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(v)).map(Number);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round(n, d = 1) {
    if (n === null || n === undefined) return '—';
    return Number(n).toFixed(d);
}

function weekStats(week) {
    const w = avg(week.days.map(d => d.weight));
    const c = avg(week.days.map(d => d.calories));
    const p = avg(week.days.map(d => d.protein));
    const workouts = week.days.filter(d => d.workout).length;
    return { avgWeight: w, avgCalories: c, avgProtein: p, workouts };
}

function weekChange(idx) {
    if (idx === 0) return null;
    const cur = weekStats(state.weeks[idx]).avgWeight;
    const prev = weekStats(state.weeks[idx - 1]).avgWeight;
    if (cur === null || prev === null) return null;
    return cur - prev;
}

/* ==================== רנדור ראשי ==================== */
function renderAll() {
    renderUserSummary();
    renderFooter();
    renderWeeks();
    renderMeals();
    renderGraphs();
    renderSettings();
}

function renderUserSummary() {
    const u = state.user;
    const stats = state.weeks.length > 0 ? weekStats(state.weeks[state.weeks.length - 1]) : null;
    const currentWeight = stats?.avgWeight;
    const totalChange = currentWeight ? (currentWeight - u.startingWeight) : null;
    const totalChangeText = totalChange === null ? '—' : (totalChange >= 0 ? '+' : '') + totalChange.toFixed(1) + ' ק״ג';
    const changeClass = totalChange < 0 ? 'change-positive' : (totalChange > 0 ? 'change-negative' : '');

    document.getElementById('userSummary').innerHTML = `
        <span class="chip">👤 ${u.name}, ${u.age}</span>
        <span class="chip">⚖️ התחלה: ${u.startingWeight} ק״ג</span>
        <span class="chip">📍 כעת: ${currentWeight ? round(currentWeight) + ' ק״ג' : '—'}</span>
        <span class="chip ${changeClass}">📉 שינוי כולל: ${totalChangeText}</span>
        <span class="chip">💪 ${u.workoutsPerWeek}× ${u.workoutType}/שבוע</span>
    `;
}

function renderFooter() {
    const u = state.user;
    const footerEl = document.querySelector('.app-footer span');
    if (footerEl) {
        footerEl.textContent = `אפליקציית מעקב אישית • ${u.name} בן ${u.age} • התחלה ${u.startingWeight} ק״ג`;
    }
}

/* ==================== מעקב שבועי ==================== */
function renderWeeks() {
    const container = document.getElementById('weeksContainer');
    if (!state.weeks.length) {
        container.innerHTML = '<div class="empty-state">אין עדיין שבועות. לחץ על "➕ הוסף שבוע חדש" כדי להתחיל.</div>';
        return;
    }
    container.innerHTML = state.weeks.map((w, i) => renderWeekCard(w, i)).join('');
    attachWeekEvents();
}

function renderWeekCard(week, idx) {
    const s = weekStats(week);
    const change = weekChange(idx);
    const changeText = change === null ? '' : (change >= 0 ? '+' : '') + change.toFixed(1);
    const changeClass = change < 0 ? 'change-positive' : (change > 0 ? 'change-negative' : '');

    const daysRows = week.days.map((d, di) => `
        <tr>
            <td class="day-name">${d.day}</td>
            <td><input type="number" step="0.1" placeholder="83.5" value="${d.weight ?? ''}" data-field="weight" data-week="${idx}" data-day="${di}"></td>
            <td><input type="number" step="1" placeholder="2000" value="${d.calories ?? ''}" data-field="calories" data-week="${idx}" data-day="${di}"></td>
            <td><input type="number" step="1" placeholder="160" value="${d.protein ?? ''}" data-field="protein" data-week="${idx}" data-day="${di}"></td>
            <td class="workout-cell"><input type="checkbox" ${d.workout ? 'checked' : ''} data-field="workout" data-week="${idx}" data-day="${di}"></td>
            <td><input type="text" placeholder="הערות" value="${d.notes || ''}" data-field="notes" data-week="${idx}" data-day="${di}"></td>
        </tr>
    `).join('');

    return `
        <div class="week-card">
            <div class="week-header">
                <div class="week-title">
                    <span class="week-number">${week.weekNumber}</span>
                    <div>
                        <div><strong>שבוע ${week.weekNumber}</strong></div>
                        <input type="text" class="week-dates-input" value="${week.dates}" data-field="dates" data-week="${idx}" placeholder="26.04-02.05">
                    </div>
                </div>
                <div class="week-summary">
                    <div class="summary-item"><span class="label">משקל ממוצע:</span> <span class="value">${round(s.avgWeight)} ק״ג</span></div>
                    <div class="summary-item"><span class="label">שינוי:</span> <span class="value ${changeClass}">${changeText || '—'} ק״ג</span></div>
                    <div class="summary-item"><span class="label">קלוריות ממוצע:</span> <span class="value">${round(s.avgCalories, 0)}</span></div>
                    <div class="summary-item"><span class="label">חלבון ממוצע:</span> <span class="value">${round(s.avgProtein, 0)} ג׳</span></div>
                    <div class="summary-item"><span class="label">אימונים:</span> <span class="value">${s.workouts}/7</span></div>
                    <button class="delete-week-btn" data-delete-week="${idx}">🗑️ מחק שבוע</button>
                </div>
            </div>
            <div style="overflow-x:auto;">
                <table class="days-table">
                    <thead>
                        <tr>
                            <th>יום</th>
                            <th>משקל (ק״ג)</th>
                            <th>קלוריות</th>
                            <th>חלבון (ג׳)</th>
                            <th>אימון</th>
                            <th>הערות יומיות</th>
                        </tr>
                    </thead>
                    <tbody>${daysRows}</tbody>
                </table>
            </div>
            <div class="week-notes">
                <label>הערות שבועיות:</label>
                <textarea data-field="weeklyNotes" data-week="${idx}" placeholder="איך הרגשת השבוע? הישגים, אתגרים...">${week.weeklyNotes || ''}</textarea>
            </div>
        </div>
    `;
}

function attachWeekEvents() {
    document.querySelectorAll('[data-week]').forEach(el => {
        const ev = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(ev, handleWeekChange);
    });
    document.querySelectorAll('[data-delete-week]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('למחוק את השבוע הזה? הפעולה אינה הפיכה.')) return;
            state.weeks.splice(Number(btn.dataset.deleteWeek), 1);
            state.weeks.forEach((w, i) => w.weekNumber = i + 1);
            saveData();
            renderAll();
        });
    });
}

function handleWeekChange(e) {
    const el = e.target;
    const wIdx = Number(el.dataset.week);
    const field = el.dataset.field;
    const week = state.weeks[wIdx];

    if (field === 'dates') {
        week.dates = el.value;
    } else if (field === 'weeklyNotes') {
        week.weeklyNotes = el.value;
    } else {
        const dIdx = Number(el.dataset.day);
        const day = week.days[dIdx];
        if (field === 'workout') {
            day.workout = el.checked;
        } else if (field === 'notes') {
            day.notes = el.value;
        } else {
            const v = el.value;
            day[field] = v === '' ? null : Number(v);
        }
    }

    saveData();
    renderUserSummary();
    updateWeekSummary(wIdx);
    renderGraphs();
}

function updateWeekSummary(idx) {
    const cards = document.querySelectorAll('.week-card');
    const card = cards[idx];
    if (!card) return;
    const s = weekStats(state.weeks[idx]);
    const change = weekChange(idx);
    const changeText = change === null ? '' : (change >= 0 ? '+' : '') + change.toFixed(1);
    const changeClass = change < 0 ? 'change-positive' : (change > 0 ? 'change-negative' : '');
    const summary = card.querySelector('.week-summary');
    summary.innerHTML = `
        <div class="summary-item"><span class="label">משקל ממוצע:</span> <span class="value">${round(s.avgWeight)} ק״ג</span></div>
        <div class="summary-item"><span class="label">שינוי:</span> <span class="value ${changeClass}">${changeText || '—'} ק״ג</span></div>
        <div class="summary-item"><span class="label">קלוריות ממוצע:</span> <span class="value">${round(s.avgCalories, 0)}</span></div>
        <div class="summary-item"><span class="label">חלבון ממוצע:</span> <span class="value">${round(s.avgProtein, 0)} ג׳</span></div>
        <div class="summary-item"><span class="label">אימונים:</span> <span class="value">${s.workouts}/7</span></div>
        <button class="delete-week-btn" data-delete-week="${idx}">🗑️ מחק שבוע</button>
    `;
    summary.querySelector('[data-delete-week]').addEventListener('click', (e) => {
        if (!confirm('למחוק את השבוע הזה? הפעולה אינה הפיכה.')) return;
        state.weeks.splice(Number(e.target.dataset.deleteWeek), 1);
        state.weeks.forEach((w, i) => w.weekNumber = i + 1);
        saveData();
        renderAll();
    });
}

/* ==================== הוספת שבוע ==================== */
function addWeek() {
    const last = state.weeks[state.weeks.length - 1];
    const nextNum = (last?.weekNumber || 0) + 1;
    const nextDates = last?.dates ? computeNextWeekDates(last.dates) : '';
    state.weeks.push(buildEmptyWeek(nextNum, nextDates));
    saveData();
    renderAll();
    setTimeout(() => {
        const cards = document.querySelectorAll('.week-card');
        cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function computeNextWeekDates(prevRange) {
    try {
        const [a, b] = prevRange.split('-');
        const parse = (s) => {
            const [d, m] = s.trim().split('.').map(Number);
            const year = new Date().getFullYear();
            return new Date(year, m - 1, d);
        };
        const fmt = (d) => String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0');
        const start = parse(a); start.setDate(start.getDate() + 7);
        const end = parse(b); end.setDate(end.getDate() + 7);
        return fmt(start) + '-' + fmt(end);
    } catch (e) { return ''; }
}

/* ==================== תפריט ==================== */
function renderMeals() {
    const plan = state.mealPlan;
    if (!plan) return;

    // כרטיס שייק עם הסבר על ימי אימון
    document.getElementById('shakeCard').innerHTML = `
        <h3>🥤 ${plan.shake.name}</h3>
        <p class="muted" style="margin:4px 0 8px 0">לאחר אימון בלבד — ימי ראשון, שני, רביעי, שישי</p>
        <ul>${plan.shake.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        <div class="shake-stats">
            <span class="stat">🔥 ${plan.shake.calories} קלוריות</span>
            <span class="stat">💪 ${plan.shake.protein} ג׳ חלבון</span>
        </div>
    `;

    document.getElementById('mealsGrid').innerHTML = plan.days.map((d, dayIdx) => {
        const workoutBadge = d.workoutTime
            ? `<span class="workout-badge">💪 אימון ${d.workoutTime}</span>`
            : `<span class="rest-badge">🛌 מנוחה</span>`;
        const slotsHtml = MEAL_SLOTS.map(slot => {
            const isShake = d.shakeSlot === slot.key;
            const isOverridden = mealOverrides[dayIdx] && mealOverrides[dayIdx][slot.key];
            const resetBtn = isOverridden ? `<button class="reset-slot-btn" data-day="${dayIdx}" data-slot="${slot.key}" title="חזור לברירת מחדל">↺</button>` : '';
            return `
                <div class="meal-row ${isShake ? 'shake-row' : ''} ${isOverridden ? 'overridden' : ''}"
                     data-day="${dayIdx}" data-slot="${slot.key}">
                    <div class="meal-label">${slot.label} ${resetBtn}</div>
                    <div class="meal-desc">${d[slot.key] || ''}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="meal-card">
                <div class="day-label">
                    <h3>${d.day}</h3>
                    <div class="day-tags">
                        ${workoutBadge}
                        <span class="theme-tag">${d.theme}</span>
                    </div>
                </div>
                ${slotsHtml}
                <div class="meal-totals">
                    <span class="stat-badge">🔥 ${d.totalCalories} קלוריות</span>
                    <span class="stat-badge">💪 ${d.totalProtein} ג׳ חלבון</span>
                </div>
                ${d.prepNote ? `<div class="prep-note">💡 ${d.prepNote}</div>` : ''}
            </div>
        `;
    }).join('');

    attachDropTargets();
    renderLibrary();
}

/* ==================== מאגר חלופות ==================== */
function renderLibrary() {
    const lib = state.mealPlan.library;
    const container = document.getElementById('libraryContainer');
    if (!container || !lib) return;

    const categories = [
        { key: 'breakfast', label: '🌅 ארוחות בוקר' },
        { key: 'snacks',    label: '🍎 חטיפי חלבון' },
        { key: 'lunch',     label: '🍽️ ארוחות צהריים' },
        { key: 'dinner',    label: '🌙 ארוחות ערב' }
    ];

    const items = lib[activeLibraryCategory] || [];
    container.innerHTML = `
        <div class="library-header">
            <h2>📚 מאגר חלופות — גרור לתפריט</h2>
            <span class="subtitle">💡 גרור כרטיסיה לארוחה בתפריט שלמעלה כדי להחליף — ${items.length} אפשרויות בקטגוריה</span>
        </div>
        <div class="library-tabs">
            ${categories.map(c => `
                <button class="lib-tab-btn ${c.key === activeLibraryCategory ? 'active' : ''}" data-cat="${c.key}">
                    ${c.label} <span class="count">${(lib[c.key] || []).length}</span>
                </button>
            `).join('')}
        </div>
        <div class="library-grid">
            ${items.map((m, i) => `
                <div class="lib-card" draggable="true" data-cat="${activeLibraryCategory}" data-idx="${i}">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="lib-card-header">
                        <h4>${m.name}</h4>
                        <span class="theme-tag">${m.theme}</span>
                    </div>
                    <ul class="lib-items">
                        ${m.items.map(it => `<li>${it}</li>`).join('')}
                    </ul>
                    <div class="lib-card-footer">
                        <span class="stat-badge">🔥 ${m.calories} קל׳</span>
                        <span class="stat-badge">💪 ${m.protein} ג׳</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.lib-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeLibraryCategory = btn.dataset.cat;
            renderLibrary();
        });
    });

    container.querySelectorAll('.lib-card').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
}

/* ==================== Drag & Drop ==================== */
let draggedItem = null;

function handleDragStart(e) {
    const cat = e.currentTarget.dataset.cat;
    const idx = Number(e.currentTarget.dataset.idx);
    const item = state.mealPlan.library[cat][idx];
    draggedItem = item;
    e.currentTarget.classList.add('dragging');
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', JSON.stringify(item));
    }
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.meal-row.drag-over').forEach(r => r.classList.remove('drag-over'));
    draggedItem = null;
}

function attachDropTargets() {
    document.querySelectorAll('.meal-row[data-day]').forEach(row => {
        row.addEventListener('dragover', handleDragOver);
        row.addEventListener('dragleave', handleDragLeave);
        row.addEventListener('drop', handleDrop);
    });
    document.querySelectorAll('.reset-slot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetMealSlot(Number(btn.dataset.day), btn.dataset.slot);
        });
    });
}

function handleDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const dayIdx = Number(e.currentTarget.dataset.day);
    const slot = e.currentTarget.dataset.slot;

    let item = draggedItem;
    if (!item) {
        try { item = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) { return; }
    }
    if (!item) return;

    // יצירת טקסט מהפריט בספרייה
    const text = `${item.name} (${item.items.join(' + ')}) — ${item.calories} קל׳ / ${item.protein} ג׳`;

    // שמירה ב-overrides
    if (!mealOverrides[dayIdx]) mealOverrides[dayIdx] = {};
    mealOverrides[dayIdx][slot] = { text, calories: item.calories, protein: item.protein };
    saveMealOverrides();

    // עדכון מיידי בתצוגה
    state.mealPlan.days[dayIdx][slot] = text;
    recalculateDayTotals(state.mealPlan.days[dayIdx]);
    renderMeals();
}

function resetMealSlot(dayIdx, slot) {
    if (!mealOverrides[dayIdx]) return;
    delete mealOverrides[dayIdx][slot];
    if (Object.keys(mealOverrides[dayIdx]).length === 0) delete mealOverrides[dayIdx];
    saveMealOverrides();
    // טעינה מחדש כדי להחזיר את הטקסט המקורי מ-data.json
    init();
}

/* ==================== גרפים ==================== */
function renderGraphs() {
    renderStats();
    renderChart('weightChart', 'weight');
    renderChart('caloriesChart', 'calories');
    renderChart('proteinChart', 'protein');
    renderChart('workoutsChart', 'workouts');
}

function renderStats() {
    const u = state.user;
    if (!state.weeks.length) {
        document.getElementById('statsRow').innerHTML = '<div class="stat-card"><div class="stat-value">—</div><div class="stat-label">אין נתונים</div></div>';
        return;
    }
    const last = weekStats(state.weeks[state.weeks.length - 1]);
    const change = last.avgWeight ? (last.avgWeight - u.startingWeight) : null;
    const weeksTracked = state.weeks.length;
    const totalWorkouts = state.weeks.reduce((sum, w) => sum + weekStats(w).workouts, 0);

    document.getElementById('statsRow').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${last.avgWeight ? round(last.avgWeight) : '—'}</div>
            <div class="stat-label">משקל נוכחי (ק״ג)</div>
        </div>
        <div class="stat-card">
            <div class="stat-value ${change < 0 ? 'change-positive' : (change > 0 ? 'change-negative' : '')}">${change === null ? '—' : (change >= 0 ? '+' : '') + change.toFixed(1)}</div>
            <div class="stat-label">שינוי כולל (ק״ג)</div>
            <div class="stat-sub muted">מ-${u.startingWeight} ק״ג</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${weeksTracked}</div>
            <div class="stat-label">שבועות במעקב</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${totalWorkouts}</div>
            <div class="stat-label">סה״כ אימונים</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${last.avgCalories ? round(last.avgCalories, 0) : '—'}</div>
            <div class="stat-label">קלוריות ממוצע (שבוע אחרון)</div>
            <div class="stat-sub muted">יעד: ${u.dailyCalorieTarget}</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${last.avgProtein ? round(last.avgProtein, 0) : '—'}</div>
            <div class="stat-label">חלבון ממוצע (ג׳)</div>
            <div class="stat-sub muted">יעד: ${u.dailyProteinTarget}</div>
        </div>
    `;
}

function renderChart(canvasId, metric) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = state.weeks.map(w => `שבוע ${w.weekNumber}`);
    let data, title, color, target;

    if (metric === 'weight') {
        data = state.weeks.map(w => weekStats(w).avgWeight);
        labels.unshift('התחלה');
        data.unshift(state.user.startingWeight);
        title = 'משקל (ק״ג)'; color = '#4f46e5';
    } else if (metric === 'calories') {
        data = state.weeks.map(w => weekStats(w).avgCalories);
        title = 'קלוריות'; color = '#f59e0b'; target = state.user.dailyCalorieTarget;
    } else if (metric === 'protein') {
        data = state.weeks.map(w => weekStats(w).avgProtein);
        title = 'חלבון (ג׳)'; color = '#10b981'; target = state.user.dailyProteinTarget;
    } else if (metric === 'workouts') {
        data = state.weeks.map(w => weekStats(w).workouts);
        title = 'אימונים'; color = '#ef4444'; target = state.user.workoutsPerWeek;
    }

    if (charts[canvasId]) charts[canvasId].destroy();

    const datasets = [{
        label: title, data, borderColor: color, backgroundColor: color + '20',
        tension: 0.3, fill: true, pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: '#fff', pointBorderColor: color, pointBorderWidth: 2, spanGaps: true
    }];
    if (target) {
        datasets.push({
            label: 'יעד', data: new Array(labels.length).fill(target),
            borderColor: '#9ca3af', borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false
        });
    }

    const isBar = metric === 'workouts';
    charts[canvasId] = new Chart(canvas, {
        type: isBar ? 'bar' : 'line',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', rtl: true, labels: { font: { family: 'Rubik, Arial' } } },
                tooltip: { rtl: true, titleFont: { family: 'Rubik, Arial' }, bodyFont: { family: 'Rubik, Arial' } }
            },
            scales: {
                x: { reverse: true, ticks: { font: { family: 'Rubik, Arial' } } },
                y: { beginAtZero: metric !== 'weight', ticks: { font: { family: 'Rubik, Arial' } } }
            }
        }
    });
    canvas.parentElement.style.height = '320px';
}

/* ==================== הגדרות ==================== */
function renderSettings() {
    const u = state.user;
    document.getElementById('settingsCard').innerHTML = `
        <h3>פרטים אישיים ויעדים</h3>
        <div class="settings-grid">
            <div class="field"><label>שם</label><input type="text" id="s-name" value="${u.name}"></div>
            <div class="field"><label>גיל</label><input type="number" id="s-age" value="${u.age}"></div>
            <div class="field"><label>משקל התחלתי (ק״ג)</label><input type="number" step="0.1" id="s-start" value="${u.startingWeight}"></div>
            <div class="field"><label>אימונים בשבוע</label><input type="number" id="s-workouts" value="${u.workoutsPerWeek}"></div>
            <div class="field"><label>יעד קלוריות יומי</label><input type="number" id="s-cal" value="${u.dailyCalorieTarget}"></div>
            <div class="field"><label>יעד חלבון יומי (ג׳)</label><input type="number" id="s-prot" value="${u.dailyProteinTarget}"></div>
        </div>
        <div class="btn-row" style="margin-top:16px;">
            <button class="btn-primary" id="saveSettingsBtn">שמור הגדרות</button>
        </div>
    `;
    document.getElementById('saveSettingsBtn').addEventListener('click', () => {
        u.name = document.getElementById('s-name').value;
        u.age = Number(document.getElementById('s-age').value);
        u.startingWeight = Number(document.getElementById('s-start').value);
        u.workoutsPerWeek = Number(document.getElementById('s-workouts').value);
        u.dailyCalorieTarget = Number(document.getElementById('s-cal').value);
        u.dailyProteinTarget = Number(document.getElementById('s-prot').value);
        saveData();
        renderAll();
        alert('✅ ההגדרות נשמרו');
    });
}

/* ==================== ייצוא/ייבוא ==================== */
function exportData() {
    const json = JSON.stringify({ ...state, mealOverrides }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diet_tracker_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loaded = JSON.parse(e.target.result);
            if (!loaded.user || !loaded.weeks) throw new Error('קובץ לא תקין');
            state = loaded;
            if (loaded.mealOverrides) {
                mealOverrides = loaded.mealOverrides;
                saveMealOverrides();
            }
            saveData();
            applyMealOverrides();
            renderAll();
            alert('✅ הנתונים יובאו בהצלחה');
        } catch (err) {
            alert('❌ שגיאה בייבוא: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function resetData() {
    if (!confirm('איפוס ימחק את כל המעקב שלך ויחזיר לברירת מחדל. להמשיך?')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(MEAL_OVERRIDES_KEY);
    mealOverrides = {};
    init();
}

/* ==================== אירועים ==================== */
function attachEvents() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'graphs') setTimeout(renderGraphs, 50);
        });
    });

    document.getElementById('addWeekBtn').addEventListener('click', addWeek);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('resetBtn').addEventListener('click', resetData);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', (e) => {
        if (e.target.files[0]) importData(e.target.files[0]);
    });
}

/* ==================== התחלה ==================== */
init();
