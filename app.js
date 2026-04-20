/* ==========================================================================
   אפליקציית מעקב דיאטה - עידן
   ========================================================================== */

const STORAGE_KEY = 'idan_diet_tracker_v1';
const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

let state = null;
let charts = {}; // Chart.js instances
let activeLibraryCategory = 'lunch'; // לשונית פעילה במאגר החלופות

/* ==================== טעינה והתחלה ==================== */
async function init() {
    state = await loadData();
    renderAll();
    attachEvents();
}

async function loadData() {
    // תמיד מביא את תפריט הבסיס והתפריט השבועי מ-data.json (כדי שעדכונים בתפריט ישתקפו מיד)
    let freshData = null;
    try {
        const res = await fetch('data.json');
        if (res.ok) freshData = await res.json();
    } catch (e) { console.warn('data.json fetch failed - using embedded defaults', e); }
    if (!freshData) freshData = getDefaultData();

    // נתוני המשתמש (שבועות, הגדרות) נטענים מ-localStorage אם קיימים
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const saved = JSON.parse(stored);
            return {
                user: saved.user || freshData.user,
                weeks: saved.weeks || freshData.weeks,
                mealPlan: freshData.mealPlan // תמיד מהקובץ העדכני
            };
        }
    } catch (e) { console.warn('localStorage read error', e); }

    return freshData;
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { console.error('save error', e); }
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
        mealPlan: getDefaultMealPlan()
    };
}

function getDefaultMealPlan() {
    return {
        shake: {
            name: 'שייק בוקר (קבוע - כל יום)',
            ingredients: ['5 כפות שיבולת שועל', '1 מנת אבקת חלבון', '1 כף חמאת בוטנים', 'חופן אוכמניות', '250 מ״ל חלב/מים'],
            calories: 450, protein: 38
        },
        days: [
            { day: 'ראשון', theme: 'ישראלי קלאסי', breakfast: 'שייק בוקר קבוע', snack1: 'יוגורט יווני 0% + חופן שקדים',
              lunch: 'חזה עוף בגריל (200 ג׳) + אורז בסמטי (כוס מבושלת) + סלט ירקות טרי עם לימון ושמן זית',
              snack2: 'גבינת קוטג׳ 5% + מלפפון', dinner: 'סלמון בתנור (180 ג׳) + בטטה אפויה + ברוקולי מאודה',
              totalCalories: 2050, totalProtein: 170, prepNote: 'העוף: תיבול בשום, לימון, כורכום ופפריקה - 12 דק׳ בגריל' },
            { day: 'שני', theme: 'אסיאתי מהיר', breakfast: 'שייק בוקר קבוע', snack1: '2 ביצים קשות',
              lunch: 'סטייק בקר טחון מוקפץ עם פלפל, גזר וברוקולי + אורז לבן (כוס מבושלת) + רוטב סויה',
              snack2: 'חטיף חלבון 25 גרם', dinner: 'קציצות הודו ברוטב עגבניות + פיתה מלאה + סלט טרי',
              totalCalories: 2020, totalProtein: 175, prepNote: 'טיפ: קנה ירקות חתוכים להקפצה כדי לחסוך זמן' },
            { day: 'שלישי', theme: 'על האש / גריל', breakfast: 'שייק בוקר קבוע', snack1: 'גבינת קוטג׳ + עגבניות שרי',
              lunch: 'סטייק אנטריקוט (180 ג׳) בגריל + תפוח אדמה אפוי + סלט ישראלי',
              snack2: 'טונה במים + 2 פריכיות אורז', dinner: 'שווארמה ביתית מחזה עוף בטורטייה מלאה + חומוס + סלט',
              totalCalories: 2080, totalProtein: 165, prepNote: 'שווארמה: תבל את העוף בבהרט, פפריקה, כמון - צלה במחבת פסים' },
            { day: 'רביעי', theme: 'אסיאתי בריא', breakfast: 'שייק בוקר קבוע', snack1: 'תפוח + כף חמאת בוטנים',
              lunch: 'עוף מוקפץ ברוטב ג׳ינג׳ר-סויה + אורז מלא + ירקות מוקפצים (גזר, פלפל, בצל)',
              snack2: 'יוגורט יווני 0% + אוכמניות', dinner: 'המבורגר בקר טחון (150 ג׳) ללא לחמנייה + צ׳יפס בטטה בתנור + סלט',
              totalCalories: 2000, totalProtein: 160, prepNote: 'המבורגר: ערבב בשר עם בצל מגורד ושום - 6 דק׳ במחבת' },
            { day: 'חמישי', theme: 'דג ים תיכוני', breakfast: 'שייק בוקר קבוע', snack1: '2 ביצים קשות + מלפפון',
              lunch: 'פילה דג (דניס/מושט) בתנור עם לימון ועשבי תיבול + אורז לבן + קישואים בתנור',
              snack2: 'גבינת קוטג׳ + עגבניות', dinner: 'שיפודי חזה עוף בגריל + פיתה + חומוס + סלט חצילים קלוי',
              totalCalories: 2020, totalProtein: 170, prepNote: 'דג: 180°C למשך 18 דק׳ - קל להכנה' },
            { day: 'שישי', theme: 'ארוחת שישי / על האש', breakfast: 'שייק בוקר קבוע', snack1: 'שייק חלבון + בננה',
              lunch: 'סטייק פרגית + קוסקוס + ירקות צלויים בגריל (קישוא, פלפל, בצל, חציל)',
              snack2: 'יוגורט יווני + חופן אגוזי מלך', dinner: 'עוף שלם צלוי בתנור + תפוחי אדמה קלויים + סלט ירוק גדול',
              totalCalories: 2100, totalProtein: 165, prepNote: 'עוף שלם: תבל בשעה לפני, 180°C למשך 70 דק׳ - מספיק גם למחר' },
            { day: 'שבת', theme: 'יום מנוחה גמיש', breakfast: 'שייק בוקר קבוע', snack1: 'טונה + מלפפון + 2 פריכיות',
              lunch: 'בשר בקר טחון ברוטב אסיאתי על אורז + ירקות מוקפצים',
              snack2: '2 ביצים קשות', dinner: 'פילה הודו בגריל + בטטה אפויה + סלט טרי עם גרעיני חמנייה',
              totalCalories: 2010, totalProtein: 168, prepNote: 'יום קל במטבח - אפשר לנצל שאריות מיום שישי' }
        ]
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
    // עדכון חי - רק הכותרת והגרפים, לא הטבלה כדי לא לאבד focus
    renderUserSummary();
    updateWeekSummary(wIdx);
    renderGraphs();
}

function updateWeekSummary(idx) {
    // רענון חלקי של סיכום השבוע בלי לפגוע בשדה הפעיל
    const cards = document.querySelectorAll('.week-card');
    const card = cards[idx];
    if (!card) return;
    const s = weekStats(state.weeks[idx]);
    const change = weekChange(idx);
    const changeText = change === null ? '' : (change >= 0 ? '+' : '') + change.toFixed(1);
    const changeClass = change < 0 ? 'change-positive' : (change > 0 ? 'change-negative' : '');
    const summary = card.querySelector('.week-summary');
    // בניה מחדש של הסיכום תוך שמירה על כפתור המחיקה
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
    // גלילה לשבוע החדש
    setTimeout(() => {
        const cards = document.querySelectorAll('.week-card');
        cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function computeNextWeekDates(prevRange) {
    // "26.04-02.05" → משבוע אחר-כך: +7 ימים לכל תאריך
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
    document.getElementById('shakeCard').innerHTML = `
        <h3>🥤 ${plan.shake.name}</h3>
        <ul>${plan.shake.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        <div class="shake-stats">
            <span class="stat">🔥 ${plan.shake.calories} קלוריות</span>
            <span class="stat">💪 ${plan.shake.protein} ג׳ חלבון</span>
        </div>
    `;

    document.getElementById('mealsGrid').innerHTML = plan.days.map(d => `
        <div class="meal-card">
            <div class="day-label">
                <h3>${d.day}</h3>
                <span class="theme-tag">${d.theme}</span>
            </div>
            <div class="meal-row"><div class="meal-label">🌅 בוקר</div><div class="meal-desc">${d.breakfast}</div></div>
            <div class="meal-row"><div class="meal-label">🍎 חטיף ביניים</div><div class="meal-desc">${d.snack1}</div></div>
            <div class="meal-row"><div class="meal-label">🍽️ צהריים</div><div class="meal-desc">${d.lunch}</div></div>
            <div class="meal-row"><div class="meal-label">🥜 חטיף אחה״צ</div><div class="meal-desc">${d.snack2}</div></div>
            <div class="meal-row"><div class="meal-label">🌙 ערב</div><div class="meal-desc">${d.dinner}</div></div>
            <div class="meal-totals">
                <span class="stat-badge">🔥 ${d.totalCalories} קלוריות</span>
                <span class="stat-badge">💪 ${d.totalProtein} ג׳ חלבון</span>
            </div>
            ${d.prepNote ? `<div class="prep-note">💡 ${d.prepNote}</div>` : ''}
        </div>
    `).join('');

    renderLibrary();
}

/* ==================== מאגר חלופות ==================== */
function renderLibrary() {
    const lib = state.mealPlan.library;
    const container = document.getElementById('libraryContainer');
    if (!container || !lib) return;

    const categories = [
        { key: 'breakfast', label: '🌅 ארוחות בוקר', icon: '🌅' },
        { key: 'snacks', label: '🍎 חטיפי חלבון', icon: '🍎' },
        { key: 'lunch', label: '🍽️ ארוחות צהריים', icon: '🍽️' },
        { key: 'dinner', label: '🌙 ארוחות ערב', icon: '🌙' }
    ];

    const items = lib[activeLibraryCategory] || [];
    container.innerHTML = `
        <div class="library-header">
            <h2>📚 מאגר חלופות — בחר לעצמך</h2>
            <span class="subtitle">${items.length} אפשרויות בקטגוריה הזו</span>
        </div>
        <div class="library-tabs">
            ${categories.map(c => `
                <button class="lib-tab-btn ${c.key === activeLibraryCategory ? 'active' : ''}" data-cat="${c.key}">
                    ${c.label} <span class="count">${(lib[c.key] || []).length}</span>
                </button>
            `).join('')}
        </div>
        <div class="library-grid">
            ${items.map(m => `
                <div class="lib-card">
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
        // הכנסה של משקל התחלתי כנקודת פתיחה
        labels.unshift('התחלה');
        data.unshift(state.user.startingWeight);
        title = 'משקל (ק״ג)';
        color = '#4f46e5';
    } else if (metric === 'calories') {
        data = state.weeks.map(w => weekStats(w).avgCalories);
        title = 'קלוריות';
        color = '#f59e0b';
        target = state.user.dailyCalorieTarget;
    } else if (metric === 'protein') {
        data = state.weeks.map(w => weekStats(w).avgProtein);
        title = 'חלבון (ג׳)';
        color = '#10b981';
        target = state.user.dailyProteinTarget;
    } else if (metric === 'workouts') {
        data = state.weeks.map(w => weekStats(w).workouts);
        title = 'אימונים';
        color = '#ef4444';
        target = state.user.workoutsPerWeek;
    }

    // השמדת הגרף הקודם
    if (charts[canvasId]) charts[canvasId].destroy();

    const datasets = [{
        label: title,
        data,
        borderColor: color,
        backgroundColor: color + '20',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: '#fff',
        pointBorderColor: color,
        pointBorderWidth: 2,
        spanGaps: true
    }];

    if (target) {
        datasets.push({
            label: 'יעד',
            data: new Array(labels.length).fill(target),
            borderColor: '#9ca3af',
            borderDash: [6, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        });
    }

    const isBar = metric === 'workouts';
    charts[canvasId] = new Chart(canvas, {
        type: isBar ? 'bar' : 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
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

    // קביעת גובה קבוע לקונטיינר
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
    const json = JSON.stringify(state, null, 2);
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
            saveData();
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
    state = getDefaultData();
    saveData();
    renderAll();
}
 
/* ==================== אירועים ==================== */
function attachEvents() {
    // לשוניות
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            // רענון גרפים כשעוברים ללשונית שלהם (Chart.js דורש גודל לעדכן)
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
 
