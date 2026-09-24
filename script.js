/* =========================================================
   إدارة المال — script.js
   تطبيق شخصي يعمل بالكامل داخل المتصفح (Client-Side).
   جميع البيانات محفوظة في localStorage — لا يوجد أي خادم.

   البنية:
   1.  Constants            ثوابت التطبيق
   2.  Utils / DateUtils    أدوات عامة وأدوات التاريخ
   3.  Storage / Store      طبقة الحفظ في localStorage
   4.  Periods              حساب الشهور المالية حسب يوم الراتب
   5.  Data                 استعلامات على البيانات
   6.  Calc                 الحسابات (الميزانية اليومية، الأرصدة، التحليلات)
   7.  UI                   النوافذ، الإشعارات، التأكيد
   8.  Components           عناصر واجهة قابلة لإعادة الاستخدام
   9.  Pages                صفحات التطبيق
   10. Forms                النماذج والتحقق من المدخلات
   11. Actions              أزرار التطبيق
   12. Backup               التصدير والاستيراد
   13. App                  التهيئة والتوجيه
   ========================================================= */
'use strict';

/* =========================================================
   1. Constants
   ========================================================= */
const STORAGE_KEYS = Object.freeze({
  settings: 'mm_settings',
  months: 'mm_months',
  transactions: 'mm_transactions',
  fixedExpenses: 'mm_fixedExpenses',
  extraIncome: 'mm_extraIncome',
  funds: 'mm_funds',
  categories: 'mm_categories',
});

const SCHEMA_VERSION = 1;
const MAX_AMOUNT = 100000000; // 100 مليون ر.س حد أعلى منطقي
const CURRENCY = 'ر.س';
const BACKUP_FILENAME = 'money-management-backup.json';

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const AR_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  setupDone: false,
  salary: 0,
  payday: 27,
  retainTarget: 0,
  openingBalance: 0,
  rolloverMode: 'nextDay', // nextDay: الفائض ينتقل لليوم التالي | spread: يوزع على الأيام المتبقية
  warnThreshold: 80,       // نسبة الصرف التي يظهر عندها "اقتربت من الحد"
  theme: 'auto',
  createdAt: null,
});

const DEFAULT_CATEGORIES = Object.freeze([
  { id: 'food', name: 'أكل وشرب', icon: '🍔', builtIn: true },
  { id: 'fuel', name: 'بنزين', icon: '⛽', builtIn: true },
  { id: 'home', name: 'أغراض البيت', icon: '🏠', builtIn: true },
  { id: 'shopping', name: 'تسوق', icon: '🛍️', builtIn: true },
  { id: 'transport', name: 'مواصلات', icon: '🚗', builtIn: true },
  { id: 'coffee', name: 'قهوة', icon: '☕', builtIn: true },
  { id: 'fun', name: 'ترفيه', icon: '🎮', builtIn: true },
  { id: 'health', name: 'صحة', icon: '💊', builtIn: true },
  { id: 'clothes', name: 'ملابس', icon: '👕', builtIn: true },
  { id: 'tech', name: 'تقنية', icon: '📱', builtIn: true },
  { id: 'other', name: 'أخرى', icon: '📦', builtIn: true },
]);

const DEFAULT_FUNDS = Object.freeze([
  { id: 'emergency', name: 'صندوق الطوارئ', description: 'احتياطي للظروف الطارئة', initialBalance: 0, goal: 0 },
  { id: 'investment', name: 'صندوق الاستثمار', description: 'أموال مخصصة للاستثمار والنمو', initialBalance: 0, goal: 0 },
]);

const EXTRA_TYPES = Object.freeze([
  { id: 'bonus', name: 'مكافأة', icon: '🏆' },
  { id: 'gift', name: 'هدية', icon: '🎁' },
  { id: 'side', name: 'دخل إضافي', icon: '💼' },
  { id: 'refund', name: 'استرداد مبلغ', icon: '↩️' },
  { id: 'other', name: 'أخرى', icon: '📦' },
]);

const FIXED_ICONS = ['🏠', '🔑', '💡', '💧', '🌐', '📱', '💳', '🚗', '🎓', '📺', '🏋️', '🏥', '🧾', '📌'];

const ROUTES = Object.freeze([
  { id: 'dashboard', title: 'الرئيسية', icon: 'home' },
  { id: 'expenses', title: 'المصروفات', icon: 'receipt' },
  { id: 'fixed', title: 'المصاريف الشهرية', icon: 'repeat' },
  { id: 'funds', title: 'الصناديق', icon: 'vault' },
  { id: 'extra', title: 'الأموال الإضافية', icon: 'gift' },
  { id: 'months', title: 'الشهور', icon: 'calendar' },
  { id: 'analytics', title: 'التحليل', icon: 'chart' },
  { id: 'settings', title: 'الإعدادات', icon: 'settings' },
]);

const STATUS_META = Object.freeze({
  good: { label: 'ضمن الميزانية', dot: '🟢' },
  near: { label: 'اقتربت من الحد', dot: '🟡' },
  over: { label: 'تجاوزت الميزانية', dot: '🔴' },
});

const CHART_COLORS = ['#0E7A58', '#2563A8', '#C98A12', '#C2410C', '#7C3AED', '#0891B2', '#BE185D', '#4D7C0F', '#6B7280', '#B45309', '#475569', '#059669'];

/* =========================================================
   2. Utils
   ========================================================= */
const Utils = {
  uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  clone(value) {
    return JSON.parse(JSON.stringify(value));
  },

  round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  },

  sum(list, pick = (x) => x) {
    return Utils.round2(list.reduce((acc, item) => acc + (Number(pick(item)) || 0), 0));
  },

  /** يحول الأرقام العربية/الفارسية إلى أرقام لاتينية */
  toLatinDigits(str) {
    return String(str ?? '')
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/٫/g, '.')
      .replace(/[٬،]/g, ',');
  },

  /** يحول النص المدخل إلى رقم، ويعيد NaN إذا كان غير صحيح */
  parseAmount(input) {
    const clean = Utils.toLatinDigits(input).replace(/,/g, '').replace(/\s/g, '');
    if (clean === '' || !/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
    return Utils.round2(parseFloat(clean));
  },

  parseInteger(input) {
    const clean = Utils.toLatinDigits(input).replace(/\s/g, '');
    if (!/^\d+$/.test(clean)) return NaN;
    return parseInt(clean, 10);
  },

  /** 15000 → "15,000" | 1500.5 → "1,500.50" */
  formatNumber(n) {
    const value = Utils.round2(Math.abs(Number(n) || 0));
    const hasFraction = Math.round(value * 100) % 100 !== 0;
    return value.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2,
    });
  },

  /** 15000 → "15,000 ر.س" (مع دعم القيم السالبة في RTL) */
  money(n) {
    const v = Utils.round2(Number(n) || 0);
    const sign = v < 0 ? '\u200E-' : '';
    return `${sign}${Utils.formatNumber(v)} ${CURRENCY}`;
  },

  /** نسخة HTML مع تنسيق خاص للعملة */
  moneyHTML(n, cls = '') {
    const v = Utils.round2(Number(n) || 0);
    const sign = v < 0 ? '\u200E-' : '';
    return `<span class="money ${cls}">${sign}${Utils.formatNumber(v)} <span class="cur">${CURRENCY}</span></span>`;
  },

  percent(part, total) {
    if (!total || total <= 0) return 0;
    return Math.max(0, Math.min(100, (part / total) * 100));
  },

  escape(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  debounce(fn, wait = 200) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  },

  icon(name, cls = '') {
    return `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  },

  isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  },

  /** عدد عشري آمن (غير سالب) */
  safeAmount(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? Utils.round2(n) : fallback;
  },
};

/* ---------- Date utilities (تعمل بصيغة YYYY-MM-DD بالتوقيت المحلي) ---------- */
const DateUtils = {
  pad(n) { return String(n).padStart(2, '0'); },

  toISO(date) {
    return `${date.getFullYear()}-${DateUtils.pad(date.getMonth() + 1)}-${DateUtils.pad(date.getDate())}`;
  },

  parse(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, m - 1, d, 12, 0, 0); // منتصف النهار لتجنب مشاكل التوقيت الصيفي
  },

  isValidISO(iso) {
    if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const d = DateUtils.parse(iso);
    return !Number.isNaN(d.getTime()) && DateUtils.toISO(d) === iso;
  },

  today() { return DateUtils.toISO(new Date()); },

  addDays(iso, n) {
    const d = DateUtils.parse(iso);
    d.setDate(d.getDate() + n);
    return DateUtils.toISO(d);
  },

  diffDays(fromIso, toIso) {
    return Math.round((DateUtils.parse(toIso) - DateUtils.parse(fromIso)) / 86400000);
  },

  daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  },

  /** "27 سبتمبر" */
  short(iso) {
    const d = DateUtils.parse(iso);
    return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
  },

  /** "27 سبتمبر 2026" */
  long(iso) {
    const d = DateUtils.parse(iso);
    return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  },

  weekday(iso) { return AR_DAYS[DateUtils.parse(iso).getDay()]; },

  dayNum(iso) { return DateUtils.parse(iso).getDate(); },

  /** "27 سبتمبر ← 26 أكتوبر 2026" */
  range(start, end) {
    const s = DateUtils.parse(start);
    const e = DateUtils.parse(end);
    const startText = s.getFullYear() === e.getFullYear() ? DateUtils.short(start) : DateUtils.long(start);
    return `${startText} ← ${DateUtils.long(end)}`;
  },

  relative(iso) {
    const today = DateUtils.today();
    if (iso === today) return 'اليوم';
    if (iso === DateUtils.addDays(today, -1)) return 'أمس';
    return `${DateUtils.weekday(iso)}، ${DateUtils.short(iso)}`;
  },
};

/* =========================================================
   3. Storage — طبقة localStorage
   ========================================================= */
const Storage = {
  isAvailable() {
    try {
      const k = '__mm_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  },

  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return Utils.clone(fallback);
      const parsed = JSON.parse(raw);
      return parsed ?? Utils.clone(fallback);
    } catch (err) {
      console.error(`Storage read failed for ${key}`, err);
      return Utils.clone(fallback);
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error(`Storage write failed for ${key}`, err);
      UI.toast('تعذّر حفظ البيانات. قد تكون مساحة التخزين ممتلئة.', 'error');
      return false;
    }
  },

  remove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  },

  usageKB() {
    let bytes = 0;
    Object.values(STORAGE_KEYS).forEach((k) => {
      const v = localStorage.getItem(k);
      if (v) bytes += v.length * 2;
    });
    return Math.round(bytes / 1024);
  },
};

/** الحالة العامة للتطبيق */
const state = {
  settings: null,
  months: [],
  transactions: [],
  fixedExpenses: [],
  extraIncome: [],
  funds: [],
  categories: [],
  ui: {
    filters: { q: '', category: 'all', account: 'all', from: '', to: '' },
    listLimit: 60,
    analyticsScope: 'current',
    monthsChartScope: null,
  },
};

const Store = {
  load() {
    const settings = Storage.read(STORAGE_KEYS.settings, {});
    state.settings = { ...DEFAULT_SETTINGS, ...(Utils.isPlainObject(settings) ? settings : {}) };
    state.months = Store.asArray(Storage.read(STORAGE_KEYS.months, []));
    state.transactions = Store.asArray(Storage.read(STORAGE_KEYS.transactions, []));
    state.fixedExpenses = Store.asArray(Storage.read(STORAGE_KEYS.fixedExpenses, []));
    state.extraIncome = Store.asArray(Storage.read(STORAGE_KEYS.extraIncome, []));

    const cats = Store.asArray(Storage.read(STORAGE_KEYS.categories, []));
    state.categories = cats.length ? cats : Utils.clone(DEFAULT_CATEGORIES);
    if (!state.categories.some((c) => c.id === 'other')) state.categories.push(Utils.clone(DEFAULT_CATEGORIES.at(-1)));

    const funds = Store.asArray(Storage.read(STORAGE_KEYS.funds, []));
    state.funds = DEFAULT_FUNDS.map((def) => ({ ...def, ...(funds.find((f) => f.id === def.id) || {}) }));

    Store.sortMonths();
  },

  asArray(v) { return Array.isArray(v) ? v : []; },

  sortMonths() { state.months.sort((a, b) => a.start.localeCompare(b.start)); },

  /** حفظ مفاتيح محددة: Store.save('transactions', 'months') */
  save(...keys) {
    const list = keys.length ? keys : Object.keys(STORAGE_KEYS);
    list.forEach((k) => Storage.write(STORAGE_KEYS[k], state[k]));
    Calc.invalidate();
  },

  resetState() {
    state.settings = { ...DEFAULT_SETTINGS };
    state.months = [];
    state.transactions = [];
    state.fixedExpenses = [];
    state.extraIncome = [];
    state.funds = Utils.clone(DEFAULT_FUNDS);
    state.categories = Utils.clone(DEFAULT_CATEGORIES);
    Calc.invalidate();
  },

  clearAll() {
    Object.values(STORAGE_KEYS).forEach((k) => Storage.remove(k));
    Store.resetState();
  },

  exportData() {
    return {
      app: 'money-management',
      appName: 'إدارة المال',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        settings: state.settings,
        months: state.months,
        transactions: state.transactions,
        fixedExpenses: state.fixedExpenses,
        extraIncome: state.extraIncome,
        funds: state.funds,
        categories: state.categories,
      },
    };
  },
};

/* =========================================================
   4. Periods — الشهر المالي يبدأ من يوم نزول الراتب
   مثال: الراتب يوم 27 ← الشهر 27 سبتمبر حتى 26 أكتوبر
   ========================================================= */
const Periods = {
  /** تاريخ نزول الراتب في شهر معين (مع مراعاة الشهور القصيرة) */
  payDate(year, monthIndex, payday) {
    const day = Math.min(payday, DateUtils.daysInMonth(year, monthIndex));
    return DateUtils.toISO(new Date(year, monthIndex, day, 12));
  },

  /** أول تاريخ راتب بعد تاريخ معين (بعده تمامًا) */
  nextPayAfter(iso, payday) {
    const d = DateUtils.parse(iso);
    let y = d.getFullYear();
    let m = d.getMonth();
    let candidate = Periods.payDate(y, m, payday);
    if (candidate <= iso) {
      m += 1;
      if (m > 11) { m = 0; y += 1; }
      candidate = Periods.payDate(y, m, payday);
    }
    return candidate;
  },

  /** الفترة المالية التي تحتوي تاريخًا معينًا */
  containing(iso, payday) {
    const d = DateUtils.parse(iso);
    let y = d.getFullYear();
    let m = d.getMonth();
    let start = Periods.payDate(y, m, payday);
    if (start > iso) {
      m -= 1;
      if (m < 0) { m = 11; y -= 1; }
      start = Periods.payDate(y, m, payday);
    }
    return { start, end: Periods.endFor(start, payday) };
  },

  endFor(start, payday) {
    return DateUtils.addDays(Periods.nextPayAfter(start, payday), -1);
  },
};

/* =========================================================
   5. Data — استعلامات
   ========================================================= */
const Data = {
  category(id) {
    return state.categories.find((c) => c.id === id) || state.categories.find((c) => c.id === 'other') || { id: 'other', name: 'أخرى', icon: '📦' };
  },

  fund(id) { return state.funds.find((f) => f.id === id); },

  accountLabel(id) {
    if (id === 'main') return 'الحساب الرئيسي';
    if (id === 'extra') return 'الأموال الإضافية';
    if (id === 'external') return 'خارج التطبيق';
    const fund = Data.fund(id);
    return fund ? fund.name : id;
  },

  expenses() { return state.transactions.filter((t) => t.type === 'expense'); },

  transfers() { return state.transactions.filter((t) => t.type === 'transfer'); },

  monthForDate(iso) { return state.months.find((m) => iso >= m.start && iso <= m.end) || null; },

  currentMonth() {
    return Data.monthForDate(DateUtils.today()) || state.months[state.months.length - 1] || null;
  },

  monthById(id) { return state.months.find((m) => m.id === id) || null; },

  firstMonth() { return state.months[0] || null; },

  isCurrent(month) {
    const today = DateUtils.today();
    return !!month && today >= month.start && today <= month.end;
  },

  extraType(id) { return EXTRA_TYPES.find((t) => t.id === id) || EXTRA_TYPES.at(-1); },
};

/* ---------- إدارة الشهور ---------- */
const Months = {
  build(start) {
    const s = state.settings;
    return {
      id: 'm_' + start,
      start,
      end: Periods.endFor(start, s.payday),
      salary: Utils.safeAmount(s.salary),
      retainTarget: Utils.safeAmount(s.retainTarget),
      fixedItems: state.fixedExpenses.map((f) => ({
        id: f.id, name: f.name, icon: f.icon || '📌', amount: Utils.safeAmount(f.amount), dueDay: f.dueDay || null,
        paid: false, paidDate: null,
      })),
      createdAt: new Date().toISOString(),
    };
  },

  /** ينشئ الشهور الناقصة تلقائيًا حتى الشهر الحالي. يعيد true إذا تغيّر شيء */
  ensure() {
    if (!state.settings.setupDone) return false;
    const today = DateUtils.today();
    let changed = false;

    if (state.months.length === 0) {
      state.months.push(Months.build(Periods.containing(today, state.settings.payday).start));
      changed = true;
    }

    let last = state.months[state.months.length - 1];
    let guard = 0;
    while (last.end < today && guard < 240) {
      state.months.push(Months.build(DateUtils.addDays(last.end, 1)));
      last = state.months[state.months.length - 1];
      changed = true;
      guard += 1;
    }

    if (changed) {
      Store.sortMonths();
      Store.save('months');
    }
    return changed;
  },

  /** إضافة شهر سابق قبل أول شهر مسجل */
  prependPrevious() {
    const first = Data.firstMonth();
    if (!first) return null;
    const end = DateUtils.addDays(first.start, -1);
    const period = Periods.containing(end, state.settings.payday);
    const month = Months.build(period.start);
    month.end = end; // ضمان عدم وجود فجوة أو تداخل
    month.id = 'm_' + month.start;
    if (state.months.some((m) => m.id === month.id)) return null;
    // الشهور السابقة تعتبر مدفوعة المصاريف الثابتة افتراضيًا
    month.fixedItems.forEach((i) => { i.paid = true; i.paidDate = month.start; });
    state.months.unshift(month);
    Store.sortMonths();
    Store.save('months');
    return month;
  },

  /** مزامنة المصاريف الثابتة للشهر الحالي مع القالب */
  syncCurrentFixed() {
    const month = Data.currentMonth();
    if (!month) return;
    const previous = new Map(month.fixedItems.map((i) => [i.id, i]));
    const items = state.fixedExpenses.map((f) => {
      const old = previous.get(f.id);
      return {
        id: f.id, name: f.name, icon: f.icon || '📌', amount: Utils.safeAmount(f.amount), dueDay: f.dueDay || null,
        paid: old ? old.paid : false, paidDate: old ? old.paidDate : null,
      };
    });
    // إذا حُذف مصروف ثابت بعد دفعه هذا الشهر نحتفظ به لأن المال خرج فعلًا
    previous.forEach((old, id) => {
      if (old.paid && !state.fixedExpenses.some((f) => f.id === id)) items.push(old);
    });
    month.fixedItems = items;
  },
};

/* =========================================================
   6. Calc — الحسابات المالية
   ========================================================= */
const Calc = {
  _cache: new Map(),

  invalidate() { this._cache.clear(); },

  memo(key, fn) {
    if (!this._cache.has(key)) this._cache.set(key, fn());
    return this._cache.get(key);
  },

  /** مصروفات الحساب الرئيسي مجمعة حسب اليوم ضمن فترة */
  spentByDay(start, end) {
    const map = {};
    state.transactions.forEach((t) => {
      if (t.type === 'expense' && t.account === 'main' && t.date >= start && t.date <= end) {
        map[t.date] = Utils.round2((map[t.date] || 0) + t.amount);
      }
    });
    return map;
  },

  /** المبالغ المنقولة للحساب الرئيسي والمضافة للميزانية اليومية */
  budgetBoosts(month) {
    return Utils.sum(
      state.transactions.filter((t) => t.type === 'transfer' && t.to === 'main' && t.affectsBudget && t.date >= month.start && t.date <= month.end),
      (t) => t.amount,
    );
  },

  /**
   * الحساب الأساسي للميزانية اليومية لشهر مالي.
   *
   * المتاح للمصروف اليومي = الراتب − المصاريف الشهرية − المبلغ المستهدف (+ أي مبالغ أضافها المستخدم للميزانية)
   *
   * وضع nextDay (الافتراضي):
   *   - الحصة الأساسية لليوم = المتبقي من المبلغ ÷ الأيام المتبقية
   *   - فائض اليوم ينتقل كاملًا إلى اليوم التالي (200 + 50 = 250)
   *   - التجاوز يُخصم من المبلغ المتبقي فيقل نصيب الأيام القادمة
   *
   * وضع spread:
   *   - ميزانية كل يوم = (المتاح − ما تم صرفه قبل اليوم) ÷ الأيام المتبقية
   */
  monthBudget(month) {
    return Calc.memo('budget:' + month.id, () => {
      const totalDays = DateUtils.diffDays(month.start, month.end) + 1;
      const fixedTotal = Utils.sum(month.fixedItems, (i) => i.amount);
      const fixedPaid = Utils.sum(month.fixedItems.filter((i) => i.paid), (i) => i.amount);
      const boosts = Calc.budgetBoosts(month);
      // بداية التسجيل (إذا بدأ المستخدم استخدام التطبيق في منتصف الشهر)
      const trackFrom = month.trackFrom && month.trackFrom > month.start ? month.trackFrom : month.start;
      const priorSpent = Utils.safeAmount(month.priorSpent);
      const pool = Utils.round2(month.salary + boosts - fixedTotal - month.retainTarget);
      const dailyPool = Math.max(0, pool);
      const distributable = Math.max(0, pool - priorSpent);
      const spentMap = Calc.spentByDay(month.start, month.end);
      const mode = state.settings.rolloverMode === 'spread' ? 'spread' : 'nextDay';
      const today = DateUtils.today();

      const rows = [];
      let remainingPool = distributable;
      let carry = 0;
      let spentSoFar = 0;

      for (let i = 0; i < totalDays; i += 1) {
        const date = DateUtils.addDays(month.start, i);
        const daysLeft = totalDays - i;
        const spent = spentMap[date] || 0;
        let base;
        let allowance;

        // أيام قبل بدء التسجيل: لا ميزانية لها، وأي مصروف فيها يُخصم من المتاح
        if (date < trackFrom) {
          rows.push({ date, base: 0, carry: 0, allowance: 0, spent: Utils.round2(spent), diff: 0, untracked: true, isToday: date === today, isFuture: date > today, isPast: date < today });
          spentSoFar += spent;
          remainingPool -= spent;
          continue;
        }

        if (mode === 'spread') {
          base = Math.max(0, (distributable - spentSoFar) / daysLeft);
          allowance = base;
        } else {
          base = Math.max(0, remainingPool / daysLeft);
          allowance = base + carry;
        }

        const diff = allowance - spent;
        rows.push({
          date,
          base: Utils.round2(base),
          carry: Utils.round2(mode === 'spread' ? 0 : carry),
          allowance: Utils.round2(allowance),
          spent: Utils.round2(spent),
          diff: Utils.round2(diff),
          isToday: date === today,
          isFuture: date > today,
          isPast: date < today,
        });

        spentSoFar += spent;
        if (mode === 'nextDay') {
          remainingPool -= base;
          if (diff >= 0) {
            carry = diff;              // ترحيل الفائض كاملًا
          } else {
            carry = 0;
            remainingPool += diff;     // التجاوز يقلل ميزانية الأيام القادمة
          }
        }
      }

      const dailySpent = Utils.round2(spentSoFar + priorSpent);
      const trackedDays = DateUtils.diffDays(trackFrom, month.end) + 1;
      return {
        trackFrom,
        priorSpent,
        totalDays,
        fixedTotal,
        fixedPaid,
        fixedUnpaid: Utils.round2(fixedTotal - fixedPaid),
        boosts,
        pool,
        dailyPool: Utils.round2(dailyPool),
        dailySpent,
        dailyRemaining: Utils.round2(dailyPool - dailySpent),
        perDayBase: Utils.round2(distributable / Math.max(1, trackedDays)),
        rows,
        mode,
        // المتبقي من الراتب هذا الشهر = الراتب − الثابتة − اليومية
        remaining: Utils.round2(month.salary + boosts - fixedTotal - dailySpent),
        // المتوقع في نهاية الشهر إذا التزم المستخدم بالميزانية
        expectedLeft: Utils.round2(month.salary + boosts - fixedTotal - Math.max(dailyPool, dailySpent)),
      };
    });
  },

  /** تحديد حالة الإنفاق: good | near | over */
  status(allowance, spent) {
    if (spent > allowance + 0.004) return 'over';
    if (allowance <= 0) return spent > 0 ? 'over' : 'near';
    const ratio = (spent / allowance) * 100;
    return ratio >= state.settings.warnThreshold ? 'near' : 'good';
  },

  /** جميع الأرصدة: الحساب الرئيسي، الأموال الإضافية، الصناديق */
  balances() {
    return Calc.memo('balances', () => Calc.computeBalances(state));
  },

  computeBalances(src) {
    const b = { main: Number(src.settings.openingBalance) || 0, extra: 0 };
    src.funds.forEach((f) => { b[f.id] = Number(f.initialBalance) || 0; });

    src.months.forEach((m) => {
      b.main += Number(m.salary) || 0;
      b.main -= Number(m.priorSpent) || 0;
      m.fixedItems.forEach((i) => { if (i.paid) b.main -= Number(i.amount) || 0; });
    });

    src.extraIncome.forEach((e) => { b.extra += Number(e.amount) || 0; });

    src.transactions.forEach((t) => {
      if (t.type === 'expense') {
        if (t.account in b) b[t.account] -= t.amount;
      } else if (t.type === 'transfer') {
        if (t.from in b) b[t.from] -= t.amount;
        if (t.to in b) b[t.to] += t.amount;
      }
    });

    Object.keys(b).forEach((k) => { b[k] = Utils.round2(b[k]); });
    return b;
  },

  /**
   * يتحقق هل ستصبح أرصدة الصناديق أو الأموال الإضافية سالبة بعد تعديل مقترح.
   * mutate: دالة تستقبل نسخة من البيانات وتعدلها.
   */
  wouldGoNegative(mutate) {
    const copy = {
      settings: state.settings,
      months: state.months,
      funds: state.funds,
      extraIncome: Utils.clone(state.extraIncome),
      transactions: Utils.clone(state.transactions),
    };
    mutate(copy);
    const b = Calc.computeBalances(copy);
    const negative = ['extra', ...state.funds.map((f) => f.id)].find((k) => b[k] < -0.004);
    return negative ? { account: negative, balance: b[negative] } : null;
  },

  /** إحصائيات شهر للتحليلات */
  monthStats(month) {
    return Calc.memo('stats:' + month.id, () => {
      const budget = Calc.monthBudget(month);
      const today = DateUtils.today();
      const elapsedDays = month.end < today ? budget.totalDays : Math.max(1, DateUtils.diffDays(month.start, today) + 1);
      const trackedElapsed = month.end < today ? DateUtils.diffDays(budget.trackFrom, month.end) + 1 : Math.max(1, DateUtils.diffDays(budget.trackFrom, today) + 1);
      const expenses = Data.expenses().filter((t) => t.date >= month.start && t.date <= month.end);
      const categoryTotals = {};
      expenses.forEach((t) => { categoryTotals[t.categoryId] = Utils.round2((categoryTotals[t.categoryId] || 0) + t.amount); });

      let overDays = 0;
      let surplusDays = 0;
      let topDay = null;
      budget.rows.forEach((r) => {
        if (r.isFuture || r.untracked) return;
        if (r.spent > r.allowance + 0.004) overDays += 1;
        else if (r.isPast && r.diff > 0.004) surplusDays += 1;
        if (r.spent > 0 && (!topDay || r.spent > topDay.spent)) topDay = r;
      });

      return {
        budget,
        elapsedDays,
        trackedElapsed,
        expenses,
        allSpent: Utils.sum(expenses, (t) => t.amount), // يشمل المصروفات من الأموال الإضافية
        categoryTotals,
        overDays,
        surplusDays,
        topDay,
      };
    });
  },
};

/* =========================================================
   7. UI — نوافذ، إشعارات، تأكيد
   ========================================================= */
const UI = {
  toast(message, type = 'success', duration = 3200) {
    const root = document.getElementById('toastRoot');
    if (!root) return;
    const icons = { success: 'check', error: 'x', info: 'alert', warn: 'alert' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="t-dot">${Utils.icon(icons[type] || 'check')}</span><span>${Utils.escape(message)}</span>`;
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    setTimeout(() => {
      el.classList.add('is-leaving');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, duration);
  },

  /** فتح نافذة (تدعم فتح نافذة فوق أخرى) */
  modal({ title, body, wide = false, onClose = null, labelledBy = null }) {
    const root = document.getElementById('modalRoot');
    const layer = document.createElement('div');
    const titleId = labelledBy || Utils.uid('mt_');
    layer.className = 'modal-layer';
    layer.innerHTML = `
      <div class="modal ${wide ? 'is-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
        <div class="modal-head">
          <h2 class="modal-title" id="${titleId}">${Utils.escape(title)}</h2>
          <button type="button" class="icon-btn icon-btn-sm" data-action="close-modal" aria-label="إغلاق">${Utils.icon('x')}</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>`;
    layer._onClose = onClose;
    layer._returnFocus = document.activeElement;
    layer.addEventListener('mousedown', (e) => { if (e.target === layer) UI.closeModal(); });
    root.appendChild(layer);
    document.body.style.overflow = 'hidden';

    requestAnimationFrame(() => {
      const focusTarget = layer.querySelector('[autofocus]') || layer.querySelector('input, select, textarea, button:not([data-action="close-modal"])');
      if (focusTarget && window.matchMedia('(min-width: 640px)').matches) focusTarget.focus();
    });
    return layer;
  },

  closeModal() {
    const root = document.getElementById('modalRoot');
    const layer = root.lastElementChild;
    if (!layer || layer.classList.contains('is-closing')) return;
    layer.classList.add('is-closing');
    const finish = () => {
      layer.remove();
      if (!root.children.length) document.body.style.overflow = '';
      if (typeof layer._onClose === 'function') layer._onClose();
      if (layer._returnFocus && document.contains(layer._returnFocus)) layer._returnFocus.focus({ preventScroll: true });
    };
    layer.addEventListener('animationend', finish, { once: true });
    setTimeout(() => { if (document.contains(layer)) finish(); }, 260);
  },

  closeAllModals() {
    document.getElementById('modalRoot').innerHTML = '';
    document.body.style.overflow = '';
  },

  topModal() { return document.getElementById('modalRoot').lastElementChild; },

  /**
   * نافذة تأكيد تعيد Promise<boolean>
   * requireText: نص يجب كتابته لتأكيد العمليات الخطيرة
   */
  confirm({ title, message, confirmText = 'تأكيد', danger = false, requireText = null, icon = null }) {
    return new Promise((resolve) => {
      let resolved = false;
      const done = (value) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };
      const body = `
        <form class="confirm-body" data-confirm-form novalidate>
          <div class="confirm-icon ${danger ? 'danger' : ''}">${Utils.icon(icon || (danger ? 'alert' : 'check'))}</div>
          <p>${message}</p>
          ${requireText ? `
            <div class="field">
              <label class="label" for="confirmInput">للتأكيد اكتب: <b>${Utils.escape(requireText)}</b></label>
              <input id="confirmInput" class="input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false">
              <p class="field-error" data-error-for="confirm"></p>
            </div>` : ''}
          <div class="form-actions">
            <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${Utils.escape(confirmText)}</button>
            <button type="button" class="btn btn-secondary" data-confirm-cancel>إلغاء</button>
          </div>
        </form>`;
      const layer = UI.modal({ title, body, onClose: () => done(false) });
      const form = layer.querySelector('[data-confirm-form]');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (requireText) {
          const value = form.querySelector('#confirmInput').value.trim();
          if (value !== requireText) {
            Forms.setError(form, 'confirm', 'النص غير مطابق.');
            return;
          }
        }
        done(true);
        UI.closeModal();
      });
      form.querySelector('[data-confirm-cancel]').addEventListener('click', () => { done(false); UI.closeModal(); });
      if (requireText) setTimeout(() => form.querySelector('#confirmInput')?.focus(), 50);
    });
  },

  applyTheme() {
    let theme = state.settings.theme || 'auto';
    if (theme === 'auto') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0B110E' : '#F4F6F3');
    document.querySelectorAll('.theme-label').forEach((el) => { el.textContent = theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'; });
  },

  /** Tooltip للرسوم البيانية */
  tip: null,
  showTip(text, x, y) {
    if (!UI.tip) {
      UI.tip = document.createElement('div');
      UI.tip.className = 'chart-tip';
      document.body.appendChild(UI.tip);
    }
    UI.tip.innerHTML = text;
    const rect = UI.tip.getBoundingClientRect();
    const left = Math.min(window.innerWidth - rect.width - 8, Math.max(8, x - rect.width / 2));
    const top = Math.max(8, y - rect.height - 12);
    UI.tip.style.left = left + 'px';
    UI.tip.style.top = top + 'px';
    UI.tip.classList.add('is-visible');
  },
  hideTip() { UI.tip?.classList.remove('is-visible'); },
};

/* =========================================================
   8. Components — عناصر قابلة لإعادة الاستخدام
   ========================================================= */
const C = {
  kpi({ label, value, icon, tone = '', hint = '', href = '' }) {
    const tag = href ? 'a' : 'div';
    return `
      <${tag} class="kpi ${tone ? 'tone-' + tone : ''}" ${href ? `href="${href}"` : ''}>
        <div class="kpi-top">
          <span class="kpi-icon">${Utils.icon(icon)}</span>
          <span class="kpi-label">${label}</span>
        </div>
        <div class="kpi-value">${value}</div>
        ${hint ? `<div class="kpi-hint">${hint}</div>` : ''}
      </${tag}>`;
  },

  empty({ icon = 'inbox', title, text = '', action = '', actionLabel = '' }) {
    return `
      <div class="empty">
        <div class="empty-icon">${Utils.icon(icon)}</div>
        <h3>${title}</h3>
        ${text ? `<p>${text}</p>` : ''}
        ${action ? `<button type="button" class="btn btn-primary btn-sm" data-action="${action}">${Utils.icon('plus', 'icon-sm')} ${actionLabel}</button>` : ''}
      </div>`;
  },

  progress(pct, tone = '', small = false) {
    return `<div class="progress ${tone} ${small ? 'progress-sm' : ''}" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct.toFixed(1)}%"></span></div>`;
  },

  statusBadge(status) {
    const m = STATUS_META[status];
    return `<span class="badge ${status}">${m.dot} ${m.label}</span>`;
  },

  /** حقل مبلغ مهيأ للجوال مع تنسيق فوري */
  amountField({ name, label, value = '', hint = '', big = false, autofocus = false, required = true, placeholder = '0' }) {
    const id = Utils.uid('f_');
    const formatted = value === '' || value === null || value === undefined ? '' : Utils.formatNumber(value);
    return `
      <div class="field" data-field="${name}">
        <label class="label" for="${id}">${label}</label>
        <div class="amount-wrap ${big ? 'is-big' : ''}">
          <input id="${id}" class="input" name="${name}" type="text" inputmode="decimal" autocomplete="off"
            enterkeyhint="done" dir="ltr" placeholder="${placeholder}" value="${formatted}" data-amount
            ${required ? 'required' : ''} ${autofocus ? 'autofocus' : ''} aria-describedby="${id}_h">
          <span class="cur">${CURRENCY}</span>
        </div>
        <p class="field-hint" id="${id}_h">${hint}</p>
        <p class="field-error" data-error-for="${name}"></p>
      </div>`;
  },

  integerField({ name, label, value = '', hint = '', min = 1, max = 31, placeholder = '' }) {
    const id = Utils.uid('f_');
    return `
      <div class="field" data-field="${name}">
        <label class="label" for="${id}">${label}</label>
        <input id="${id}" class="input" name="${name}" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off"
          dir="ltr" style="text-align:right" data-integer data-min="${min}" data-max="${max}" placeholder="${placeholder}" value="${Utils.escape(value)}">
        ${hint ? `<p class="field-hint">${hint}</p>` : ''}
        <p class="field-error" data-error-for="${name}"></p>
      </div>`;
  },

  textField({ name, label, value = '', placeholder = '', maxlength = 80, hint = '' }) {
    const id = Utils.uid('f_');
    return `
      <div class="field" data-field="${name}">
        <label class="label" for="${id}">${label}</label>
        <input id="${id}" class="input" name="${name}" type="text" maxlength="${maxlength}" placeholder="${Utils.escape(placeholder)}" value="${Utils.escape(value)}" autocomplete="off">
        ${hint ? `<p class="field-hint">${hint}</p>` : ''}
        <p class="field-error" data-error-for="${name}"></p>
      </div>`;
  },

  dateField({ name, label, value, min = '', max = '' }) {
    const id = Utils.uid('f_');
    return `
      <div class="field" data-field="${name}">
        <label class="label" for="${id}">${label}</label>
        <input id="${id}" class="input" name="${name}" type="date" value="${value}" ${min ? `min="${min}"` : ''} ${max ? `max="${max}"` : ''} required>
        <p class="field-error" data-error-for="${name}"></p>
      </div>`;
  },

  selectField({ name, label, options, value }) {
    const id = Utils.uid('f_');
    return `
      <div class="field" data-field="${name}">
        <label class="label" for="${id}">${label}</label>
        <select id="${id}" class="select" name="${name}">
          ${options.map((o) => `<option value="${Utils.escape(o.value)}" ${o.value === value ? 'selected' : ''}>${Utils.escape(o.label)}</option>`).join('')}
        </select>
        <p class="field-error" data-error-for="${name}"></p>
      </div>`;
  },

  formActions(submitLabel = 'حفظ') {
    return `
      <div class="form-actions">
        <button type="submit" class="btn btn-primary btn-lg">${submitLabel}</button>
        <button type="button" class="btn btn-secondary btn-lg" data-action="close-modal">إلغاء</button>
      </div>`;
  },

  /** صف مصروف في القوائم المختصرة */
  expenseRow(t) {
    const cat = Data.category(t.categoryId);
    return `
      <li class="row">
        <span class="row-icon" aria-hidden="true">${cat.icon}</span>
        <div class="row-main">
          <div class="row-title">${Utils.escape(t.description || cat.name)}</div>
          <div class="row-sub">${t.description ? Utils.escape(cat.name) + ' · ' : ''}${DateUtils.relative(t.date)}${t.account !== 'main' ? ' · ' + Utils.escape(Data.accountLabel(t.account)) : ''}</div>
        </div>
        <div class="row-end"><div class="row-amount neg">${Utils.money(t.amount)}</div></div>
      </li>`;
  },

  /** صف حركة تحويل */
  transferRow(t, { deletable = true } = {}) {
    const isIn = t.to !== 'external' && t.from === 'external';
    return `
      <li class="row">
        <span class="row-icon">${Utils.icon(t.kind === 'withdraw' ? 'out' : 'transfer')}</span>
        <div class="row-main">
          <div class="row-title">${Utils.escape(Data.accountLabel(t.from))} ← ${Utils.escape(Data.accountLabel(t.to))}</div>
          <div class="row-sub">${DateUtils.relative(t.date)}${t.note ? ' · ' + Utils.escape(t.note) : ''}${t.affectsBudget ? ' · أضيف للميزانية اليومية' : ''}</div>
        </div>
        <div class="row-end"><div class="row-amount ${isIn ? 'pos' : ''}">${Utils.money(t.amount)}</div></div>
        ${deletable ? `<div class="row-actions"><button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-transfer" data-id="${t.id}" aria-label="حذف العملية">${Utils.icon('trash')}</button></div>` : ''}
      </li>`;
  },

  /** رسم بياني يومي: أعمدة المصروف + خط الميزانية */
  dailyChart(rows, { showFuture = true } = {}) {
    const list = showFuture ? rows : rows.filter((r) => !r.isFuture);
    if (!list.length) return C.empty({ icon: 'chart', title: 'لا توجد بيانات بعد' });
    // الأيام القادمة تُعرض بحصتها الأساسية فقط (بدون ترحيل متوقع) حتى لا يتشوه المقياس
    const limitOf = (r) => (r.isFuture ? r.base : r.allowance);
    const max = Math.max(1, ...list.map((r) => Math.max(r.spent, limitOf(r))));
    const niceMax = C.niceNumber(max);
    const labelEvery = list.length > 20 ? 5 : list.length > 10 ? 2 : 1;
    const cols = list.map((r, i) => {
      const status = r.isFuture || r.untracked ? 'future' : r.spent === 0 ? 'nospend' : Calc.status(r.allowance, r.spent);
      const h = Utils.percent(r.spent, niceMax);
      const lim = Utils.percent(limitOf(r), niceMax);
      const tip = r.untracked
        ? `<b>${DateUtils.weekday(r.date)} ${DateUtils.short(r.date)}</b><br>قبل بدء التسجيل`
        : `<b>${DateUtils.weekday(r.date)} ${DateUtils.short(r.date)}</b><br>${r.isFuture ? 'الحصة الأساسية' : 'الميزانية'}: ${Utils.money(limitOf(r))}<br>المصروف: ${Utils.money(r.spent)}`;
      const showLabel = i % labelEvery === 0 || r.isToday;
      return `
        <div class="bar-col ${status} ${r.isToday ? 'is-today' : ''}" data-tip="${Utils.escape(tip)}">
          <div class="bar-track">
            <span class="bar-limit" style="bottom:${lim.toFixed(1)}%"></span>
            <span class="bar" style="height:${h.toFixed(1)}%"></span>
          </div>
          <span class="bar-label">${showLabel ? DateUtils.dayNum(r.date) : ''}</span>
        </div>`;
    }).join('');
    const grid = [1, 0.5, 0].map((f) => `<span data-v="${Utils.formatNumber(niceMax * f)}"></span>`).join('');
    return `
      <div class="chart-bars" role="img" aria-label="رسم بياني للمصروف اليومي مقارنة بالميزانية">
        <div class="chart-grid">${grid}</div>
        ${cols}
      </div>
      <div class="chart-legend">
        <span><i style="background:var(--good)"></i>ضمن الميزانية</span>
        <span><i style="background:var(--near)"></i>قريب من الحد</span>
        <span><i style="background:var(--over)"></i>تجاوز</span>
        <span><i class="line"></i>الميزانية اليومية</span>
      </div>`;
  },

  niceNumber(n) {
    if (n <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(n)));
    const f = n / exp;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * exp;
  },

  /** رسم دائري للتصنيفات */
  donut(segments, centerLabel, centerValue) {
    const total = segments.reduce((a, s) => a + s.value, 0);
    if (total <= 0) return '';
    let offset = 0;
    const circles = segments.map((s) => {
      const pct = (s.value / total) * 100;
      const gap = segments.length > 1 ? 0.6 : 0;
      const c = `<circle r="15.9155" cx="18" cy="18" stroke="${s.color}" stroke-dasharray="${Math.max(0, pct - gap)} ${100 - Math.max(0, pct - gap)}" stroke-dashoffset="${-offset}"><title>${Utils.escape(s.label)}: ${Utils.money(s.value)}</title></circle>`;
      offset += pct;
      return c;
    }).join('');
    return `
      <div class="donut">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle r="15.9155" cx="18" cy="18" stroke="var(--surface-3)"></circle>
          ${circles}
        </svg>
        <div class="donut-center"><span>${centerLabel}</span><strong>${centerValue}</strong></div>
      </div>`;
  },

  categoryBars(categoryTotals) {
    const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((a, [, v]) => a + v, 0);
    if (!entries.length) return { html: '', segments: [], total: 0 };
    const segments = entries.map(([id, value], i) => {
      const cat = Data.category(id);
      return { id, value, label: `${cat.icon} ${cat.name}`, color: CHART_COLORS[i % CHART_COLORS.length] };
    });
    const html = `
      <div class="cat-bars">
        ${segments.map((s) => {
          const pct = Utils.percent(s.value, total);
          return `
            <div>
              <div class="cat-bar-top">
                <span class="name"><i style="background:${s.color}"></i>${Utils.escape(s.label)}</span>
                <span class="val">${Utils.money(s.value)}<small>${pct.toFixed(0)}%</small></span>
              </div>
              <div class="progress progress-sm"><span style="width:${pct.toFixed(1)}%;background:${s.color}"></span></div>
            </div>`;
        }).join('')}
      </div>`;
    return { html, segments, total };
  },
};

/* =========================================================
   9. Pages
   ========================================================= */
const Pages = {
  /* ---------------- الإعداد الأولي ---------------- */
  setup() {
    return `
      <section class="setup">
        <div class="setup-hero">
          <svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="currentColor"/>
            <path d="M8.5 22.5h15" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55"/>
            <path d="M10.5 19v-3.5M16 19v-7M21.5 19V9" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
          </svg>
          <h2>مرحبًا بك في إدارة المال</h2>
          <p>أدخل بيانات راتبك مرة واحدة، وسيحسب التطبيق ميزانيتك اليومية تلقائيًا.</p>
        </div>

        <div class="card">
          <form class="form" data-form="setup" novalidate>
            ${C.amountField({ name: 'salary', label: 'مبلغ الراتب الشهري', hint: 'صافي الراتب الذي ينزل في حسابك', big: true })}
            ${C.integerField({ name: 'payday', label: 'يوم نزول الراتب', value: '27', hint: 'مثال: 27 يعني أن الشهر المالي من 27 إلى 26 من الشهر التالي', min: 1, max: 31 })}
            ${C.amountField({ name: 'retainTarget', label: 'المبلغ الذي تريد أن يتبقى في نهاية الشهر', hint: 'هذا المبلغ لن يدخل في الميزانية اليومية', required: false })}
            <div class="grid-2">
              ${C.amountField({ name: 'emergency', label: 'رصيد صندوق الطوارئ الحالي', required: false })}
              ${C.amountField({ name: 'investment', label: 'رصيد صندوق الاستثمار الحالي', required: false })}
            </div>
            ${C.amountField({ name: 'priorSpent', label: 'كم صرفت من بداية الشهر المالي الحالي حتى أمس؟ (اختياري)', hint: 'إذا بدأت استخدام التطبيق في منتصف الشهر، يُخصم هذا المبلغ من ميزانية الأيام المتبقية', required: false })}
            ${C.amountField({ name: 'openingBalance', label: 'رصيد سابق في الحساب الرئيسي (اختياري)', hint: 'أي مبلغ متبقٍ من قبل نزول آخر راتب', required: false })}
            <div class="callout">${Utils.icon('lock')}<p>جميع بياناتك تُحفظ على هذا الجهاز فقط داخل المتصفح، ولا تُرسل إلى أي خادم.</p></div>
            <button type="submit" class="btn btn-primary btn-lg btn-block">ابدأ الآن</button>
          </form>
          <div class="divider">أو</div>
          <div class="grid-2">
            <button type="button" class="btn btn-soft btn-block" data-action="load-demo">${Utils.icon('chart')} تجربة ببيانات تجريبية</button>
            <button type="button" class="btn btn-secondary btn-block" data-action="import">${Utils.icon('upload')} استعادة نسخة احتياطية</button>
          </div>
        </div>
      </section>`;
  },

  /* ---------------- الرئيسية ---------------- */
  dashboard() {
    const month = Data.currentMonth();
    if (!month) return C.empty({ title: 'لا يوجد شهر مالي', text: 'أعد تحميل الصفحة.' });

    const b = Calc.monthBudget(month);
    const bal = Calc.balances();
    const today = DateUtils.today();
    const idx = b.rows.findIndex((r) => r.isToday);
    const row = b.rows[idx] || { allowance: 0, spent: 0, diff: 0, carry: 0, base: 0 };
    const tomorrow = idx >= 0 ? b.rows[idx + 1] : null;
    const status = Calc.status(row.allowance, row.spent);
    const leftToday = Utils.round2(row.allowance - row.spent);
    const pct = row.allowance > 0 ? Utils.percent(row.spent, row.allowance) : row.spent > 0 ? 100 : 0;
    const daysLeft = DateUtils.diffDays(today, month.end) + 1;
    const paidCount = month.fixedItems.filter((i) => i.paid).length;
    const emergency = Data.fund('emergency');
    const investment = Data.fund('investment');

    const notes = [];
    if (row.carry > 0.004) notes.push(`يشمل فائض الأيام السابقة <b>${Utils.money(row.carry)}</b>`);
    if (row.base < b.perDayBase - 0.5) notes.push(`انخفضت الحصة اليومية بسبب تجاوز سابق`);
    if (b.mode === 'spread' && row.allowance > b.perDayBase + 0.5) notes.push('ارتفعت الحصة بسبب توفيرك في الأيام السابقة');
    if (tomorrow) notes.push(`ميزانية الغد المتوقعة <b>${Utils.money(tomorrow.allowance)}</b>`);

    const recent = Data.expenses().sort((a, c) => (c.date + c.createdAt).localeCompare(a.date + a.createdAt)).slice(0, 6);
    const unpaid = month.fixedItems.filter((i) => !i.paid);
    const poolUsedPct = Utils.percent(b.dailySpent, b.dailyPool);
    const poolTone = b.dailySpent > b.dailyPool ? 'over' : poolUsedPct > 85 ? 'near' : 'good';

    return `
      ${b.pool < 0 ? `<div class="callout danger" style="margin-bottom:16px">${Utils.icon('alert')}<p>المصاريف الشهرية والمبلغ المستهدف (${Utils.money(b.fixedTotal + month.retainTarget)}) أكبر من الراتب. لا توجد ميزانية للمصروف اليومي هذا الشهر.</p></div>` : ''}

      <div class="dash-top">
        <section class="hero status-${status}" aria-label="ميزانية اليوم">
          <div class="hero-top">
            <div>
              <p class="hero-eyebrow">${leftToday >= 0 ? 'المتاح اليوم' : 'تجاوزت ميزانية اليوم بمبلغ'} · ${DateUtils.weekday(today)} ${DateUtils.short(today)}</p>
              <p class="hero-amount">${Utils.formatNumber(Math.abs(leftToday))}<span class="cur">${CURRENCY}</span></p>
            </div>
            <span class="status-pill">${STATUS_META[status].dot} ${STATUS_META[status].label}</span>
          </div>
          <div class="hero-stats">
            <div class="hero-stat"><span>ميزانية اليوم</span><strong>${Utils.money(row.allowance)}</strong></div>
            <div class="hero-stat"><span>تم صرفه</span><strong>${Utils.money(row.spent)}</strong></div>
            <div class="hero-stat"><span>${leftToday >= 0 ? 'المتبقي' : 'التجاوز'}</span><strong>${Utils.money(Math.abs(leftToday))}</strong></div>
          </div>
          <div class="hero-progress"><span style="width:${pct.toFixed(1)}%"></span></div>
          ${notes.length ? `<p class="hero-note">${notes.map((n) => `<span>${n}</span>`).join('')}</p>` : ''}
          <div class="hero-actions">
            <button type="button" class="btn btn-hero" data-action="add-expense">${Utils.icon('plus')} إضافة مصروف</button>
          </div>
        </section>

        <div class="kpi-grid">
          ${C.kpi({ label: 'الراتب', value: Utils.money(month.salary), icon: 'coins', tone: 'primary', hint: `يوم ${state.settings.payday} من كل شهر` })}
          ${C.kpi({ label: 'الرصيد الحالي', value: Utils.money(bal.main), icon: 'wallet', tone: bal.main < 0 ? 'over' : 'good', hint: 'الحساب الرئيسي' })}
          ${C.kpi({ label: 'المصاريف الشهرية', value: Utils.money(b.fixedTotal), icon: 'repeat', tone: 'info', hint: `مدفوع ${paidCount} من ${month.fixedItems.length}`, href: '#fixed' })}
          ${C.kpi({ label: 'مصروف اليوم', value: Utils.money(row.spent), icon: 'receipt', tone: status, hint: `من ${Utils.money(row.allowance)}` })}
        </div>
      </div>

      <div class="kpi-grid" style="margin-top:12px">
        ${C.kpi({ label: 'المتاح اليوم', value: Utils.money(Math.max(0, leftToday)), icon: 'check', tone: status })}
        ${C.kpi({ label: 'المبلغ المستهدف', value: Utils.money(month.retainTarget), icon: 'target', tone: 'gold', hint: `المتوقع: ${Utils.money(b.expectedLeft)}` })}
        ${C.kpi({ label: emergency.name, value: Utils.money(bal.emergency), icon: 'shield', tone: 'info', href: '#funds' })}
        ${C.kpi({ label: investment.name, value: Utils.money(bal.investment), icon: 'trend', tone: 'gold', href: '#funds' })}
      </div>

      <div class="dash-grid section">
        <div class="stack">
          <section class="card">
            <div class="card-head">
              <h3 class="card-title">${Utils.icon('calendar')} الشهر المالي الحالي</h3>
              <span class="badge primary">متبقٍ ${daysLeft} ${daysLeft === 1 ? 'يوم' : daysLeft === 2 ? 'يومان' : daysLeft <= 10 ? 'أيام' : 'يومًا'}</span>
            </div>
            <p class="section-sub" style="margin-bottom:14px">${DateUtils.range(month.start, month.end)}</p>
            <div class="detail-grid" style="margin-bottom:16px">
              <div class="detail-box"><span>المتاح للمصروف اليومي</span><strong>${Utils.money(b.dailyPool)}</strong></div>
              <div class="detail-box"><span>المصروف حتى الآن</span><strong>${Utils.money(b.dailySpent)}</strong></div>
              <div class="detail-box"><span>المتبقي للأيام القادمة</span><strong class="${b.dailyRemaining < 0 ? 'over-text' : ''}">${Utils.money(b.dailyRemaining)}</strong></div>
              <div class="detail-box"><span>الحصة الأساسية يوميًا</span><strong>${Utils.money(b.perDayBase)}</strong></div>
            </div>
            ${C.progress(poolUsedPct, poolTone)}
            <div class="progress-meta"><span>استهلكت ${poolUsedPct.toFixed(0)}% من ميزانية المصروف اليومي</span><span>${Utils.percent(b.totalDays - daysLeft + 1, b.totalDays).toFixed(0)}% من الشهر</span></div>
          </section>

          <section class="card">
            <div class="card-head">
              <h3 class="card-title">${Utils.icon('chart')} الإنفاق اليومي هذا الشهر</h3>
              <a class="link-btn" href="#analytics">التحليل</a>
            </div>
            ${C.dailyChart(b.rows)}
          </section>
        </div>

        <div class="stack">
          <section class="card">
            <div class="card-head">
              <h3 class="card-title">${Utils.icon('receipt')} آخر المصروفات</h3>
              ${recent.length ? '<a class="link-btn" href="#expenses">عرض الكل</a>' : ''}
            </div>
            ${recent.length ? `<ul class="list">${recent.map(C.expenseRow).join('')}</ul>` : C.empty({ title: 'لا توجد مصروفات بعد', text: 'سجّل أول مصروف لتبدأ متابعة ميزانيتك اليومية.', action: 'add-expense', actionLabel: 'إضافة مصروف' })}
          </section>

          <section class="card">
            <div class="card-head">
              <h3 class="card-title">${Utils.icon('repeat')} مصاريف شهرية لم تُدفع</h3>
              <a class="link-btn" href="#fixed">إدارة</a>
            </div>
            ${unpaid.length ? `<ul class="list">${unpaid.slice(0, 5).map((i) => `
              <li class="row">
                <span class="row-icon">${i.icon}</span>
                <div class="row-main"><div class="row-title">${Utils.escape(i.name)}</div><div class="row-sub">${i.dueDay ? 'يستحق يوم ' + i.dueDay : 'مصروف شهري'}</div></div>
                <div class="row-end"><div class="row-amount">${Utils.money(i.amount)}</div></div>
                <button type="button" class="btn btn-soft btn-sm" data-action="toggle-fixed-paid" data-month="${month.id}" data-id="${i.id}">دفع</button>
              </li>`).join('')}</ul>`
              : month.fixedItems.length
                ? `<div class="callout good">${Utils.icon('check')}<p>تم دفع جميع المصاريف الشهرية لهذا الشهر.</p></div>`
                : C.empty({ icon: 'repeat', title: 'لم تضف مصاريف شهرية', text: 'مثل الإيجار والكهرباء والإنترنت.', action: 'add-fixed', actionLabel: 'إضافة مصروف شهري' })}
          </section>

          <section class="card">
            <div class="card-head">
              <h3 class="card-title">${Utils.icon('gift')} الأموال الإضافية</h3>
              <a class="link-btn" href="#extra">إدارة</a>
            </div>
            <div class="kpi-value" style="font-size:1.5rem">${Utils.money(bal.extra)}</div>
            <p class="section-sub">رصيد منفصل لا يؤثر على ميزانيتك اليومية</p>
          </section>
        </div>
      </div>`;
  },

  /* ---------------- المصروفات ---------------- */
  expenses() {
    const f = state.ui.filters;
    const catOptions = [{ value: 'all', label: 'كل التصنيفات' }, ...state.categories.map((c) => ({ value: c.id, label: `${c.icon} ${c.name}` }))];
    const month = Data.currentMonth();
    return `
      <div class="toolbar" role="search">
        <div class="search">
          <label class="sr-only" for="fq">بحث</label>
          ${Utils.icon('search')}
          <input id="fq" class="input" type="search" placeholder="ابحث في الوصف أو التصنيف أو المبلغ" value="${Utils.escape(f.q)}" data-filter="q" autocomplete="off">
        </div>
        <div class="field">
          <label class="label" for="fcat">التصنيف</label>
          <select id="fcat" class="select" data-filter="category">
            ${catOptions.map((o) => `<option value="${o.value}" ${o.value === f.category ? 'selected' : ''}>${Utils.escape(o.label)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="label" for="facc">الحساب</label>
          <select id="facc" class="select" data-filter="account">
            <option value="all" ${f.account === 'all' ? 'selected' : ''}>كل الحسابات</option>
            <option value="main" ${f.account === 'main' ? 'selected' : ''}>الحساب الرئيسي</option>
            <option value="extra" ${f.account === 'extra' ? 'selected' : ''}>الأموال الإضافية</option>
          </select>
        </div>
        <div class="field">
          <label class="label" for="ffrom">من تاريخ</label>
          <input id="ffrom" class="input" type="date" value="${f.from}" data-filter="from">
        </div>
        <div class="field">
          <label class="label" for="fto">إلى تاريخ</label>
          <input id="fto" class="input" type="date" value="${f.to}" data-filter="to">
        </div>
        <div class="toolbar-actions">
          <div class="seg" role="group" aria-label="فترات سريعة">
            <button type="button" data-action="quick-range" data-range="today">اليوم</button>
            <button type="button" data-action="quick-range" data-range="month" ${month ? '' : 'disabled'}>الشهر الحالي</button>
            <button type="button" data-action="quick-range" data-range="all">الكل</button>
          </div>
          <button type="button" class="link-btn" data-action="clear-filters">مسح التصفية</button>
        </div>
      </div>
      <div id="expenseList"></div>`;
  },

  renderExpenseList() {
    const container = document.getElementById('expenseList');
    if (!container) return;
    const f = state.ui.filters;
    const q = Utils.toLatinDigits(f.q.trim().toLowerCase()).replace(/,/g, '');
    const all = Data.expenses();

    const filtered = all.filter((t) => {
      if (f.category !== 'all' && t.categoryId !== f.category) return false;
      if (f.account !== 'all' && t.account !== f.account) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (q) {
        const cat = Data.category(t.categoryId);
        const hay = `${t.description || ''} ${cat.name} ${t.amount} ${Utils.formatNumber(t.amount).replace(/,/g, '')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date + (b.createdAt || '')).localeCompare(a.date + (a.createdAt || '')));

    if (!all.length) {
      container.innerHTML = C.empty({ icon: 'receipt', title: 'لا توجد مصروفات مسجلة', text: 'ابدأ بتسجيل مصروفاتك اليومية لمعرفة أين يذهب مالك.', action: 'add-expense', actionLabel: 'إضافة مصروف' });
      return;
    }
    if (!filtered.length) {
      container.innerHTML = C.empty({ icon: 'search', title: 'لا توجد نتائج', text: 'جرّب تغيير كلمات البحث أو إعدادات التصفية.' });
      return;
    }

    const total = Utils.sum(filtered, (t) => t.amount);
    const shown = filtered.slice(0, state.ui.listLimit);
    container.innerHTML = `
      <div class="summary-strip">
        <span>عدد العمليات: <b>${filtered.length}</b></span>
        <span>الإجمالي: <b>${Utils.money(total)}</b></span>
        <span>المتوسط: <b>${Utils.money(total / filtered.length)}</b></span>
      </div>
      <div class="card table-card">
        <table class="tx-table">
          <thead>
            <tr><th></th><th>التصنيف</th><th>الوصف</th><th>التاريخ</th><th>الحساب</th><th>المبلغ</th><th><span class="sr-only">إجراءات</span></th></tr>
          </thead>
          <tbody>
            ${shown.map((t) => {
              const cat = Data.category(t.categoryId);
              return `
                <tr>
                  <td class="td-icon"><span class="row-icon" aria-hidden="true">${cat.icon}</span></td>
                  <td class="td-cat">${Utils.escape(cat.name)}${t.description ? `<span class="tx-desc-inline"> · ${Utils.escape(t.description)}</span>` : ''}</td>
                  <td class="td-desc">${Utils.escape(t.description || '—')}</td>
                  <td class="td-date">${DateUtils.weekday(t.date)}، ${DateUtils.long(t.date)}<span class="tx-desc-inline"> · ${Utils.escape(Data.accountLabel(t.account))}</span></td>
                  <td class="td-acc"><span class="badge ${t.account === 'main' ? 'primary' : 'info'}">${Utils.escape(Data.accountLabel(t.account))}</span></td>
                  <td class="td-amount">${Utils.money(t.amount)}</td>
                  <td class="td-actions">
                    <div class="row-actions">
                      <button type="button" class="icon-btn icon-btn-sm" data-action="edit-expense" data-id="${t.id}" aria-label="تعديل">${Utils.icon('edit')}</button>
                      <button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-expense" data-id="${t.id}" aria-label="حذف">${Utils.icon('trash')}</button>
                    </div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${filtered.length > shown.length ? `<div style="text-align:center;margin-top:14px"><button type="button" class="btn btn-secondary" data-action="load-more">عرض المزيد (${filtered.length - shown.length})</button></div>` : ''}`;
  },

  /* ---------------- المصاريف الشهرية ---------------- */
  fixed() {
    const month = Data.currentMonth();
    const b = Calc.monthBudget(month);
    const items = month.fixedItems;
    const paidPct = Utils.percent(b.fixedPaid, b.fixedTotal);

    return `
      <div class="callout" style="margin-bottom:16px">${Utils.icon('alert')}<p>المصاريف الشهرية الثابتة تُخصم من الراتب مباشرة ولا تدخل في ميزانية المصروف اليومي. عند الضغط على "دفع" يُخصم المبلغ من رصيد الحساب الرئيسي.</p></div>

      <div class="kpi-grid">
        ${C.kpi({ label: 'إجمالي المصاريف الشهرية', value: Utils.money(b.fixedTotal), icon: 'repeat', tone: 'info' })}
        ${C.kpi({ label: 'تم دفعه', value: Utils.money(b.fixedPaid), icon: 'check', tone: 'good' })}
        ${C.kpi({ label: 'متبقٍ للدفع', value: Utils.money(b.fixedUnpaid), icon: 'alert', tone: b.fixedUnpaid > 0 ? 'near' : 'good' })}
        ${C.kpi({ label: 'نسبتها من الراتب', value: `${Utils.percent(b.fixedTotal, month.salary).toFixed(0)}%`, icon: 'chart', tone: 'primary' })}
      </div>

      <section class="card section">
        <div class="card-head">
          <div>
            <h3 class="card-title">${Utils.icon('calendar')} مصاريف هذا الشهر</h3>
            <p class="section-sub">${DateUtils.range(month.start, month.end)}</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-action="add-fixed">${Utils.icon('plus', 'icon-sm')} إضافة</button>
        </div>
        ${items.length ? `
          ${C.progress(paidPct, 'good')}
          <div class="progress-meta"><span>تم دفع ${items.filter((i) => i.paid).length} من ${items.length}</span><span>${paidPct.toFixed(0)}%</span></div>
          <ul class="list" style="margin-top:8px">
            ${items.map((i) => {
              const inTemplate = state.fixedExpenses.some((f) => f.id === i.id);
              return `
              <li class="row row-wrap">
                <span class="row-icon">${i.icon}</span>
                <div class="row-main">
                  <div class="row-title">${Utils.escape(i.name)}</div>
                  <div class="row-sub">${i.paid ? `تم الدفع ${i.paidDate ? '· ' + DateUtils.short(i.paidDate) : ''}` : i.dueDay ? 'يستحق يوم ' + i.dueDay : 'لم يُدفع بعد'}${inTemplate ? '' : ' · محذوف من القائمة'}</div>
                </div>
                <div class="row-end">
                  <div class="row-amount">${Utils.money(i.amount)}</div>
                  ${i.paid ? '<span class="badge good">مدفوع</span>' : '<span class="badge near">غير مدفوع</span>'}
                </div>
                <div class="row-actions">
                  <button type="button" class="btn ${i.paid ? 'btn-ghost' : 'btn-soft'} btn-sm" data-action="toggle-fixed-paid" data-month="${month.id}" data-id="${i.id}">${i.paid ? 'تراجع' : 'دفع'}</button>
                  ${inTemplate ? `
                    <button type="button" class="icon-btn icon-btn-sm" data-action="edit-fixed" data-id="${i.id}" aria-label="تعديل">${Utils.icon('edit')}</button>
                    <button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-fixed" data-id="${i.id}" aria-label="حذف">${Utils.icon('trash')}</button>` : ''}
                </div>
              </li>`;
            }).join('')}
          </ul>`
          : C.empty({ icon: 'repeat', title: 'لا توجد مصاريف شهرية', text: 'أضف التزاماتك الثابتة مثل قسط البيت، الإيجار، الكهرباء، الإنترنت، الجوال، الديون والاشتراكات.', action: 'add-fixed', actionLabel: 'إضافة مصروف شهري' })}
      </section>`;
  },

  /* ---------------- الصناديق ---------------- */
  funds() {
    const bal = Calc.balances();
    const history = Data.transfers()
      .filter((t) => state.funds.some((f) => f.id === t.from || f.id === t.to))
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

    const fundCard = (fund, icon) => {
      const balance = bal[fund.id];
      const goalPct = fund.goal > 0 ? Utils.percent(balance, fund.goal) : 0;
      return `
        <article class="fund-card ${fund.id}">
          <div class="fund-head">
            <span class="fund-badge">${Utils.icon(icon)}</span>
            <div style="flex:1;min-width:0">
              <div class="fund-name">${Utils.escape(fund.name)}</div>
              <div class="fund-desc">${Utils.escape(fund.description || '')}</div>
            </div>
            <button type="button" class="icon-btn icon-btn-sm" data-action="edit-fund" data-id="${fund.id}" aria-label="إعدادات الصندوق">${Utils.icon('edit')}</button>
          </div>
          <div class="fund-balance">${Utils.money(balance)}</div>
          ${fund.goal > 0 ? `
            ${C.progress(goalPct, fund.id === 'emergency' ? 'info' : 'gold', true)}
            <div class="progress-meta"><span>الهدف ${Utils.money(fund.goal)}</span><span>${goalPct.toFixed(0)}%</span></div>` : '<p class="section-sub">لم يتم تحديد هدف — يمكنك تحديده من زر التعديل</p>'}
          <div class="fund-actions">
            <button type="button" class="btn btn-primary" data-action="fund-deposit" data-id="${fund.id}">${Utils.icon('in')} إيداع</button>
            <button type="button" class="btn btn-secondary" data-action="fund-withdraw" data-id="${fund.id}" ${balance <= 0 ? 'disabled' : ''}>${Utils.icon('out')} سحب</button>
          </div>
        </article>`;
    };

    return `
      <div class="balance-banner" style="margin-bottom:16px">
        <div><div class="bb-label">رصيد الحساب الرئيسي المتاح للتحويل</div><div class="bb-value">${Utils.money(bal.main)}</div></div>
        <span class="badge info">التحويل للصناديق لا يقلل ميزانيتك اليومية</span>
      </div>
      <div class="grid-2">
        ${fundCard(Data.fund('emergency'), 'shield')}
        ${fundCard(Data.fund('investment'), 'trend')}
      </div>
      <section class="card section">
        <div class="card-head"><h3 class="card-title">${Utils.icon('transfer')} سجل عمليات الصناديق</h3></div>
        ${history.length ? `<ul class="list">${history.map((t) => C.transferRow(t)).join('')}</ul>` : C.empty({ icon: 'vault', title: 'لا توجد عمليات بعد', text: 'حوّل جزءًا من رصيدك إلى صندوق الطوارئ أو الاستثمار.' })}
      </section>`;
  },

  /* ---------------- الأموال الإضافية ---------------- */
  extra() {
    const bal = Calc.balances();
    const incomes = [...state.extraIncome].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const moves = Data.transfers().filter((t) => t.from === 'extra' || t.to === 'extra').sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    const spentFromExtra = Utils.sum(Data.expenses().filter((t) => t.account === 'extra'), (t) => t.amount);
    const totalIn = Utils.sum(state.extraIncome, (e) => e.amount);

    return `
      <div class="callout" style="margin-bottom:16px">${Utils.icon('gift')}<p>الأموال الإضافية (مكافأة، هدية، دخل إضافي، استرداد) تبقى في رصيد منفصل ولا تدخل تلقائيًا في الحساب الرئيسي أو الميزانية اليومية، حتى تقرر ماذا تفعل بها.</p></div>

      <div class="kpi-grid">
        ${C.kpi({ label: 'الرصيد الإضافي المتاح', value: Utils.money(bal.extra), icon: 'gift', tone: 'primary' })}
        ${C.kpi({ label: 'إجمالي ما تم استلامه', value: Utils.money(totalIn), icon: 'in', tone: 'good' })}
        ${C.kpi({ label: 'تم صرفه منها', value: Utils.money(spentFromExtra), icon: 'receipt', tone: 'near' })}
        ${C.kpi({ label: 'عدد الإيداعات', value: String(state.extraIncome.length), icon: 'tag', tone: 'info' })}
      </div>

      <div class="grid-2 section" style="margin-top:16px">
        <button type="button" class="btn btn-primary btn-lg" data-action="add-extra">${Utils.icon('plus')} إضافة مبلغ إضافي</button>
        <div class="grid-2" style="grid-template-columns:1fr 1fr">
          <button type="button" class="btn btn-secondary btn-lg" data-action="extra-move" data-to="main" ${bal.extra <= 0 ? 'disabled' : ''}>${Utils.icon('wallet')} للحساب الرئيسي</button>
          <button type="button" class="btn btn-secondary btn-lg" data-action="extra-move" data-to="fund" ${bal.extra <= 0 ? 'disabled' : ''}>${Utils.icon('vault')} لصندوق</button>
        </div>
      </div>

      <div class="dash-grid section">
        <section class="card">
          <div class="card-head"><h3 class="card-title">${Utils.icon('in')} المبالغ المستلمة</h3></div>
          ${incomes.length ? `<ul class="list">${incomes.map((e) => {
            const type = Data.extraType(e.type);
            return `
              <li class="row row-wrap">
                <span class="row-icon">${type.icon}</span>
                <div class="row-main">
                  <div class="row-title">${Utils.escape(e.description || type.name)}</div>
                  <div class="row-sub">${type.name} · ${DateUtils.long(e.date)}</div>
                </div>
                <div class="row-end"><div class="row-amount pos">+${Utils.money(e.amount)}</div></div>
                <div class="row-actions">
                  <button type="button" class="icon-btn icon-btn-sm" data-action="edit-extra" data-id="${e.id}" aria-label="تعديل">${Utils.icon('edit')}</button>
                  <button type="button" class="icon-btn icon-btn-sm danger" data-action="delete-extra" data-id="${e.id}" aria-label="حذف">${Utils.icon('trash')}</button>
                </div>
              </li>`;
          }).join('')}</ul>` : C.empty({ icon: 'gift', title: 'لا توجد أموال إضافية', text: 'سجّل أي مكافأة أو هدية أو دخل إضافي هنا.', action: 'add-extra', actionLabel: 'إضافة مبلغ' })}
        </section>
        <section class="card">
          <div class="card-head"><h3 class="card-title">${Utils.icon('transfer')} ماذا فعلت بها</h3></div>
          ${moves.length ? `<ul class="list">${moves.map((t) => C.transferRow(t)).join('')}</ul>` : '<p class="section-sub">لم تنقل أي مبلغ بعد. يمكنك نقلها للحساب الرئيسي، أو لأحد الصناديق، أو صرفها مباشرة عند إضافة مصروف واختيار حساب "الأموال الإضافية".</p>'}
        </section>
      </div>`;
  },

  /* ---------------- الشهور ---------------- */
  months() {
    const list = [...state.months].reverse();
    return `
      <div class="section-head" style="margin-top:4px">
        <p class="section-sub">كل شهر مالي يبدأ يوم نزول الراتب (${state.settings.payday}) وينتهي قبله بيوم. اضغط على أي شهر لرؤية التفاصيل.</p>
        <button type="button" class="btn btn-secondary btn-sm" data-action="add-prev-month">${Utils.icon('plus', 'icon-sm')} شهر سابق</button>
      </div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
        ${list.map((m) => {
          const b = Calc.monthBudget(m);
          const current = Data.isCurrent(m);
          const usedPct = Utils.percent(b.fixedTotal + b.dailySpent, m.salary + b.boosts);
          const tone = b.remaining < m.retainTarget ? (b.remaining < 0 ? 'over' : 'near') : 'good';
          return `
            <button type="button" class="month-card ${current ? 'is-current' : ''}" data-action="open-month" data-id="${m.id}">
              <div class="month-head">
                <span class="month-range">${DateUtils.range(m.start, m.end)}</span>
                ${current ? '<span class="badge primary">الشهر الحالي</span>' : `<span class="badge ${tone}">${b.remaining >= m.retainTarget ? 'حققت الهدف' : 'أقل من الهدف'}</span>`}
              </div>
              <div class="month-stats">
                <div class="month-stat"><span>الراتب</span><strong>${Utils.money(m.salary)}</strong></div>
                <div class="month-stat"><span>المصاريف الثابتة</span><strong>${Utils.money(b.fixedTotal)}</strong></div>
                <div class="month-stat"><span>المصروفات اليومية</span><strong>${Utils.money(b.dailySpent)}</strong></div>
                <div class="month-stat"><span>المتبقي</span><strong class="${b.remaining < 0 ? 'over-text' : 'good-text'}">${Utils.money(b.remaining)}</strong></div>
              </div>
              ${C.progress(usedPct, tone, true)}
              <div class="progress-meta"><span>تم استخدام ${usedPct.toFixed(0)}% من الدخل</span><span>الهدف ${Utils.money(m.retainTarget)}</span></div>
            </button>`;
        }).join('')}
      </div>`;
  },

  monthDetails(month) {
    const s = Calc.monthStats(month);
    const b = s.budget;
    const cats = C.categoryBars(s.categoryTotals);
    const isFirst = Data.firstMonth()?.id === month.id;
    const canDelete = isFirst && state.months.length > 1 && !Data.isCurrent(month) && s.expenses.length === 0;
    return `
      <div class="stack">
        <div class="detail-grid">
          <div class="detail-box"><span>الراتب</span><strong>${Utils.money(month.salary)}</strong></div>
          <div class="detail-box"><span>المصاريف الثابتة</span><strong>${Utils.money(b.fixedTotal)}</strong></div>
          <div class="detail-box"><span>المصروفات اليومية</span><strong>${Utils.money(b.dailySpent)}</strong></div>
          <div class="detail-box"><span>المتبقي</span><strong class="${b.remaining < 0 ? 'over-text' : 'good-text'}">${Utils.money(b.remaining)}</strong></div>
          <div class="detail-box"><span>المبلغ المستهدف</span><strong>${Utils.money(month.retainTarget)}</strong></div>
          <div class="detail-box"><span>المتاح للمصروف اليومي</span><strong>${Utils.money(b.dailyPool)}</strong></div>
          <div class="detail-box"><span>أيام التجاوز</span><strong class="over-text">${s.overDays}</strong></div>
          <div class="detail-box"><span>أيام الفائض</span><strong class="good-text">${s.surplusDays}</strong></div>
        </div>
        ${b.priorSpent > 0 || b.trackFrom > month.start ? `<div class="callout">${Utils.icon('calendar')}<p>بدأ التسجيل في هذا الشهر من ${DateUtils.long(b.trackFrom)}${b.priorSpent > 0 ? `، مع مصروف سابق قدره ${Utils.money(b.priorSpent)} قبل بدء التسجيل` : ''}.</p></div>` : ''}
        ${b.boosts > 0 ? `<div class="callout good">${Utils.icon('in')}<p>أضفت ${Utils.money(b.boosts)} من الأموال الإضافية إلى ميزانية هذا الشهر.</p></div>` : ''}

        <div>
          <h4 class="section-title" style="margin-bottom:10px">الإنفاق اليومي</h4>
          ${C.dailyChart(b.rows)}
        </div>

        <div>
          <h4 class="section-title" style="margin-bottom:10px">حسب التصنيف</h4>
          ${cats.html || '<p class="section-sub">لا توجد مصروفات في هذا الشهر.</p>'}
        </div>

        <div>
          <h4 class="section-title" style="margin-bottom:10px">المصاريف الثابتة</h4>
          ${month.fixedItems.length ? `<ul class="list">${month.fixedItems.map((i) => `
            <li class="row">
              <span class="row-icon">${i.icon}</span>
              <div class="row-main"><div class="row-title">${Utils.escape(i.name)}</div></div>
              <div class="row-end"><div class="row-amount">${Utils.money(i.amount)}</div></div>
              <button type="button" class="btn ${i.paid ? 'btn-ghost' : 'btn-soft'} btn-sm" data-action="toggle-fixed-paid" data-month="${month.id}" data-id="${i.id}">${i.paid ? '✓ مدفوع' : 'دفع'}</button>
            </li>`).join('')}</ul>` : '<p class="section-sub">لا توجد مصاريف ثابتة لهذا الشهر.</p>'}
        </div>

        <div>
          <h4 class="section-title" style="margin-bottom:10px">تفاصيل الأيام</h4>
          <div class="day-table-wrap">
            <table class="day-table">
              <thead><tr><th>اليوم</th><th>الميزانية</th><th>المصروف</th><th>الفرق</th><th>الحالة</th></tr></thead>
              <tbody>
                ${b.rows.map((r) => {
                  const st = r.isFuture || r.untracked ? null : Calc.status(r.allowance, r.spent);
                  return `<tr class="${r.isToday ? 'is-today' : ''} ${r.isFuture || r.untracked ? 'is-future' : ''}">
                    <td>${DateUtils.weekday(r.date)} ${DateUtils.short(r.date)}</td>
                    <td>${Utils.money(r.allowance)}</td>
                    <td>${Utils.money(r.spent)}</td>
                    <td class="${r.isFuture || r.untracked ? '' : r.diff < 0 ? 'over-text' : 'good-text'}">${r.isFuture || r.untracked ? '—' : Utils.money(r.diff)}</td>
                    <td>${st ? STATUS_META[st].dot : '·'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <p class="field-hint" style="margin-top:6px">${b.mode === 'nextDay' ? 'الفائض ينتقل كاملًا لليوم التالي، والتجاوز يوزع على الأيام المتبقية.' : 'الفائض والتجاوز يوزعان على الأيام المتبقية.'}</p>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="edit-month" data-id="${month.id}">${Utils.icon('edit')} تعديل راتب وهدف الشهر</button>
          ${canDelete ? `<button type="button" class="btn btn-danger-soft" data-action="delete-month" data-id="${month.id}">${Utils.icon('trash')} حذف الشهر</button>` : ''}
        </div>
      </div>`;
  },

  /* ---------------- التحليل ---------------- */
  analytics() {
    const scope = state.ui.analyticsScope;
    const months = scope === 'all' ? state.months : [scope === 'current' ? Data.currentMonth() : Data.monthById(scope) || Data.currentMonth()];
    const statsList = months.map((m) => Calc.monthStats(m));

    const totalFixed = Utils.sum(statsList, (s) => s.budget.fixedTotal);
    const totalDaily = Utils.sum(statsList, (s) => s.allSpent);
    const totalAll = Utils.round2(totalFixed + totalDaily);
    const elapsed = statsList.reduce((a, s) => a + s.trackedElapsed, 0);
    const avgDaily = elapsed ? totalDaily / elapsed : 0;
    const overDays = statsList.reduce((a, s) => a + s.overDays, 0);
    const surplusDays = statsList.reduce((a, s) => a + s.surplusDays, 0);

    const catTotals = {};
    statsList.forEach((s) => Object.entries(s.categoryTotals).forEach(([k, v]) => { catTotals[k] = Utils.round2((catTotals[k] || 0) + v); }));
    const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    const topCat = topCatEntry ? Data.category(topCatEntry[0]) : null;

    // أعلى يوم إنفاق (كل الحسابات)
    const byDay = {};
    statsList.forEach((s) => s.expenses.forEach((t) => { byDay[t.date] = Utils.round2((byDay[t.date] || 0) + t.amount); }));
    const topDayEntry = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];

    const cats = C.categoryBars(catTotals);
    const scopeOptions = [
      { value: 'current', label: 'الشهر الحالي' },
      { value: 'all', label: 'كل الشهور' },
      ...[...state.months].reverse().filter((m) => !Data.isCurrent(m)).map((m) => ({ value: m.id, label: DateUtils.range(m.start, m.end) })),
    ];

    const singleMonth = months.length === 1 ? months[0] : null;
    const maxIncome = Math.max(1, ...state.months.map((m) => m.salary + Calc.monthBudget(m).boosts));

    return `
      <div class="section-head" style="margin-top:4px">
        <p class="section-sub">${singleMonth ? DateUtils.range(singleMonth.start, singleMonth.end) : `${state.months.length} شهر مالي`}</p>
        <div class="field" style="min-width:220px">
          <label class="sr-only" for="ascope">الفترة</label>
          <select id="ascope" class="select" data-analytics-scope>
            ${scopeOptions.map((o) => `<option value="${o.value}" ${o.value === scope ? 'selected' : ''}>${Utils.escape(o.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="kpi-grid">
        ${C.kpi({ label: 'إجمالي المصروفات', value: Utils.money(totalAll), icon: 'receipt', tone: 'primary', hint: 'الثابتة + اليومية' })}
        ${C.kpi({ label: 'إجمالي المصاريف الثابتة', value: Utils.money(totalFixed), icon: 'repeat', tone: 'info' })}
        ${C.kpi({ label: 'إجمالي المصروفات اليومية', value: Utils.money(totalDaily), icon: 'wallet', tone: 'gold' })}
        ${C.kpi({ label: 'متوسط الإنفاق اليومي', value: Utils.money(avgDaily), icon: 'chart', tone: 'primary', hint: `خلال ${elapsed} يوم` })}
        ${C.kpi({ label: 'أكثر تصنيف تم الإنفاق عليه', value: topCat ? `${topCat.icon} ${Utils.escape(topCat.name)}` : '—', icon: 'tag', tone: 'near', hint: topCatEntry ? Utils.money(topCatEntry[1]) : '' })}
        ${C.kpi({ label: 'أعلى يوم إنفاق', value: topDayEntry ? Utils.money(topDayEntry[1]) : '—', icon: 'flame', tone: 'over', hint: topDayEntry ? `${DateUtils.weekday(topDayEntry[0])} ${DateUtils.long(topDayEntry[0])}` : '' })}
        ${C.kpi({ label: 'أيام تجاوز الميزانية', value: `${overDays} يوم`, icon: 'alert', tone: 'over' })}
        ${C.kpi({ label: 'أيام الفائض', value: `${surplusDays} يوم`, icon: 'check', tone: 'good' })}
      </div>

      ${singleMonth ? `
        <section class="card section">
          <div class="card-head"><h3 class="card-title">${Utils.icon('chart')} المصروف اليومي مقابل الميزانية</h3></div>
          ${C.dailyChart(Calc.monthBudget(singleMonth).rows)}
        </section>` : ''}

      <div class="dash-grid section">
        <section class="card">
          <div class="card-head"><h3 class="card-title">${Utils.icon('tag')} الإنفاق حسب التصنيف</h3></div>
          ${cats.total > 0 ? `<div class="donut-wrap">${C.donut(cats.segments, 'الإجمالي', Utils.money(cats.total))}${cats.html}</div>` : C.empty({ icon: 'tag', title: 'لا توجد مصروفات في هذه الفترة' })}
        </section>

        <section class="card">
          <div class="card-head"><h3 class="card-title">${Utils.icon('calendar')} مقارنة الشهور</h3></div>
          <div class="hbar-group">
            ${[...state.months].reverse().slice(0, 12).map((m) => {
              const b = Calc.monthBudget(m);
              const income = m.salary + b.boosts;
              const w = (v) => Utils.percent(v, maxIncome).toFixed(1);
              const left = Math.max(0, income - b.fixedTotal - b.dailySpent);
              return `
                <div>
                  <div class="hbar-row-label"><b>${DateUtils.short(m.start)} ← ${DateUtils.short(m.end)}</b><span>متبقٍ ${Utils.money(b.remaining)}</span></div>
                  <div class="hbar-stack" title="ثابتة ${Utils.money(b.fixedTotal)} · يومية ${Utils.money(b.dailySpent)}">
                    <span class="s-fixed" style="width:${w(Math.min(b.fixedTotal, income))}%"></span>
                    <span class="s-daily" style="width:${w(Math.min(b.dailySpent, Math.max(0, income - b.fixedTotal)))}%"></span>
                    <span class="s-left" style="width:${w(left)}%"></span>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <div class="chart-legend">
            <span><i style="background:var(--info)"></i>المصاريف الثابتة</span>
            <span><i style="background:var(--primary)"></i>المصروفات اليومية</span>
            <span><i style="background:color-mix(in srgb, var(--good) 35%, transparent)"></i>المتبقي</span>
          </div>
        </section>
      </div>`;
  },

  /* ---------------- الإعدادات ---------------- */
  settings() {
    const s = state.settings;
    return `
      <div class="dash-grid">
        <div class="stack">
          <section class="card">
            <div class="card-head"><h3 class="card-title">${Utils.icon('coins')} الراتب والشهر المالي</h3></div>
            <form class="form" data-form="settings" novalidate>
              ${C.amountField({ name: 'salary', label: 'مبلغ الراتب', value: s.salary })}
              ${C.integerField({ name: 'payday', label: 'يوم نزول الراتب', value: String(s.payday), hint: 'من 1 إلى 31 — إذا كان الشهر أقصر يُعتمد آخر يوم فيه', min: 1, max: 31 })}
              ${C.amountField({ name: 'retainTarget', label: 'المبلغ المستهدف الاحتفاظ به نهاية الشهر', value: s.retainTarget, required: false })}
              ${C.amountField({ name: 'openingBalance', label: 'الرصيد الافتتاحي للحساب الرئيسي', value: s.openingBalance, required: false, hint: 'المبلغ الموجود في الحساب قبل أول راتب مسجل' })}
              <fieldset class="field">
                <legend class="label">طريقة التعامل مع الفائض</legend>
                <div class="radio-cards">
                  <label class="radio-card"><input type="radio" name="rolloverMode" value="nextDay" ${s.rolloverMode !== 'spread' ? 'checked' : ''}><div><strong>ترحيل لليوم التالي</strong><small>فائض اليوم يضاف كاملًا لميزانية الغد (200 + 50 = 250)</small></div></label>
                  <label class="radio-card"><input type="radio" name="rolloverMode" value="spread" ${s.rolloverMode === 'spread' ? 'checked' : ''}><div><strong>توزيع على الأيام المتبقية</strong><small>الفائض والتجاوز يوزعان بالتساوي على باقي الشهر</small></div></label>
                </div>
              </fieldset>
              ${C.integerField({ name: 'warnThreshold', label: 'تنبيه "اقتربت من الحد" عند نسبة صرف (%)', value: String(s.warnThreshold), min: 50, max: 99 })}
              <p class="field-hint">تُطبّق تغييرات الراتب والمبلغ المستهدف على الشهر الحالي والشهور القادمة. الشهور السابقة تبقى كما هي.</p>
              <button type="submit" class="btn btn-primary btn-lg">حفظ الإعدادات</button>
            </form>
          </section>

          <section class="card">
            <div class="card-head"><h3 class="card-title">${Utils.icon('tag')} تصنيفات المصروفات</h3></div>
            <div class="cat-list">
              ${state.categories.map((c) => `
                <span class="cat-pill">${c.icon} ${Utils.escape(c.name)}
                  ${c.id !== 'other' ? `<button type="button" data-action="delete-category" data-id="${c.id}" aria-label="حذف تصنيف ${Utils.escape(c.name)}">${Utils.icon('x')}</button>` : ''}
                </span>`).join('')}
            </div>
            <form class="inline-panel is-open" data-form="category" style="margin-top:14px" novalidate>
              <input class="input emoji-input" name="icon" maxlength="4" placeholder="🏷️" aria-label="رمز التصنيف">
              <input class="input" name="name" maxlength="24" placeholder="اسم التصنيف الجديد" style="flex:1;min-width:140px" aria-label="اسم التصنيف">
              <button type="submit" class="btn btn-primary">إضافة</button>
            </form>
          </section>
        </div>

        <div class="stack">
          <section class="card">
            <div class="card-head"><h3 class="card-title">${Utils.icon('download')} النسخ الاحتياطي</h3></div>
            <div class="settings-group">
              <div class="setting-row">
                <div><h4>تصدير البيانات</h4><p>تنزيل ملف ${BACKUP_FILENAME} يحتوي كل بياناتك</p></div>
                <button type="button" class="btn btn-soft btn-sm" data-action="export">${Utils.icon('download', 'icon-sm')} تصدير</button>
              </div>
              <div class="setting-row">
                <div><h4>استيراد البيانات</h4><p>استعادة البيانات من ملف نسخة احتياطية</p></div>
                <button type="button" class="btn btn-secondary btn-sm" data-action="import">${Utils.icon('upload', 'icon-sm')} استيراد</button>
              </div>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3 class="card-title">${Utils.icon('sun')} المظهر</h3></div>
            <div class="seg" role="group" aria-label="المظهر">
              <button type="button" data-action="set-theme" data-theme="light" class="${s.theme === 'light' ? 'is-active' : ''}">فاتح</button>
              <button type="button" data-action="set-theme" data-theme="dark" class="${s.theme === 'dark' ? 'is-active' : ''}">داكن</button>
              <button type="button" data-action="set-theme" data-theme="auto" class="${s.theme === 'auto' ? 'is-active' : ''}">تلقائي</button>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3 class="card-title">${Utils.icon('lock')} الخصوصية والتخزين</h3></div>
            <p class="section-sub">كل البيانات محفوظة في localStorage داخل هذا المتصفح فقط. لا يوجد خادم ولا تسجيل دخول. حجم البيانات الحالي: <b>${Storage.usageKB()} كيلوبايت</b>.</p>
            <p class="section-sub" style="margin-top:8px">مسح بيانات الموقع من إعدادات المتصفح سيحذف بياناتك، لذا صدّر نسخة احتياطية بانتظام.</p>
          </section>

          <section class="card" style="border-color:color-mix(in srgb, var(--over) 35%, var(--border))">
            <div class="card-head"><h3 class="card-title" style="color:var(--over)">${Utils.icon('alert')} منطقة الخطر</h3></div>
            <div class="setting-row" style="padding-top:0">
              <div><h4>حذف جميع البيانات</h4><p>حذف نهائي لكل الشهور والمصروفات والصناديق والإعدادات</p></div>
              <button type="button" class="btn btn-danger btn-sm" data-action="reset-all">${Utils.icon('trash', 'icon-sm')} حذف الكل</button>
            </div>
          </section>
        </div>
      </div>`;
  },
};

/* =========================================================
   10. Forms — النماذج والتحقق
   ========================================================= */
const Forms = {
  setError(form, name, message) {
    const el = form.querySelector(`[data-error-for="${name}"]`);
    if (el) el.textContent = message;
    const field = form.querySelector(`[data-field="${name}"]`) || el?.closest('.field');
    field?.classList.toggle('has-error', !!message);
  },

  clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((el) => { el.textContent = ''; });
    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
  },

  /** يعرض الأخطاء ويعيد true إذا لا توجد أخطاء */
  showErrors(form, errors) {
    Forms.clearErrors(form);
    const keys = Object.keys(errors);
    keys.forEach((k) => Forms.setError(form, k, errors[k]));
    if (keys.length) {
      const first = form.querySelector(`[name="${keys[0]}"]`);
      first?.focus();
      return false;
    }
    return true;
  },

  /** التحقق من مبلغ */
  amount(raw, { required = true, allowZero = false, max = MAX_AMOUNT } = {}) {
    const text = String(raw ?? '').trim();
    if (!text) return required ? { error: 'هذا الحقل مطلوب.' } : { value: 0 };
    if (/-/.test(Utils.toLatinDigits(text))) return { error: 'لا يمكن إدخال قيمة سالبة.' };
    const value = Utils.parseAmount(text);
    if (Number.isNaN(value)) return { error: 'أدخل مبلغًا صحيحًا (أرقام فقط، وحتى خانتين عشريتين).' };
    if (!allowZero && value <= 0) return { error: 'يجب أن يكون المبلغ أكبر من صفر.' };
    if (value > max) return { error: `المبلغ أكبر من الحد المسموح (${Utils.money(max)}).` };
    return { value };
  },

  integer(raw, { min, max, label = 'القيمة' }) {
    const value = Utils.parseInteger(String(raw ?? '').trim());
    if (Number.isNaN(value)) return { error: `أدخل ${label} كرقم صحيح.` };
    if (value < min || value > max) return { error: `يجب أن تكون ${label} بين ${min} و ${max}.` };
    return { value };
  },

  text(raw, { required = false, max = 80, label = 'النص' } = {}) {
    const value = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (required && !value) return { error: `${label} مطلوب.` };
    if (value.length > max) return { error: `${label} طويل جدًا (الحد ${max} حرفًا).` };
    return { value };
  },

  date(raw, { min = '', max = '' } = {}) {
    const value = String(raw ?? '').trim();
    if (!DateUtils.isValidISO(value)) return { error: 'اختر تاريخًا صحيحًا.' };
    if (min && value < min) return { error: `التاريخ يجب أن يكون من ${DateUtils.long(min)} أو بعده.` };
    if (max && value > max) return { error: `لا يمكن اختيار تاريخ بعد ${DateUtils.long(max)}.` };
    return { value };
  },

  /** يجمع التحقق لعدة حقول */
  validate(form, schema) {
    const fd = new FormData(form);
    const values = {};
    const errors = {};
    Object.entries(schema).forEach(([name, check]) => {
      const res = check(fd.get(name));
      if (res.error) errors[name] = res.error;
      else values[name] = res.value;
    });
    return { values, errors, ok: Forms.showErrors(form, errors) };
  },

  /* ---------- تنسيق حقول المبالغ أثناء الكتابة ---------- */
  formatAmountInput(input) {
    const raw = Utils.toLatinDigits(input.value);
    const caret = input.selectionStart ?? raw.length;
    const significantBefore = raw.slice(0, caret).replace(/[^\d.]/g, '').length;

    let cleaned = raw.replace(/[^\d.]/g, '');
    const dot = cleaned.indexOf('.');
    if (dot !== -1) cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
    let [intPart = '', decPart] = cleaned.split('.');
    intPart = intPart.replace(/^0+(?=\d)/, '').slice(0, 9);
    let result = intPart ? Number(intPart).toLocaleString('en-US') : decPart !== undefined ? '0' : '';
    if (decPart !== undefined) result += '.' + decPart.slice(0, 2);

    if (input.value !== result) {
      input.value = result;
      let pos = 0;
      let count = 0;
      while (pos < result.length && count < significantBefore) {
        if (/[\d.]/.test(result[pos])) count += 1;
        pos += 1;
      }
      try { input.setSelectionRange(pos, pos); } catch (e) { /* ignore */ }
    }
  },

  formatIntegerInput(input) {
    const cleaned = Utils.toLatinDigits(input.value).replace(/\D/g, '').slice(0, 3);
    if (input.value !== cleaned) input.value = cleaned;
  },

  /* ---------- نموذج المصروف ---------- */
  openExpense(expense = null) {
    const month = Data.currentMonth();
    if (!month) return;
    const first = Data.firstMonth();
    const today = DateUtils.today();
    const isEdit = !!expense;
    const selectedCat = expense?.categoryId || 'food';
    const bal = Calc.balances();

    const body = `
      <form class="form" data-form="expense" novalidate>
        <input type="hidden" name="id" value="${isEdit ? expense.id : ''}">
        ${C.amountField({ name: 'amount', label: 'المبلغ', value: isEdit ? expense.amount : '', big: true, autofocus: true })}
        <fieldset class="field" data-field="categoryId">
          <legend class="label">التصنيف</legend>
          <div class="chips" role="radiogroup" data-cat-chips>${Forms.categoryChips(selectedCat)}</div>
          <div class="inline-panel" data-inline-cat style="margin-top:10px">
            <input class="input emoji-input" data-new-cat-icon maxlength="4" placeholder="🏷️" aria-label="رمز التصنيف">
            <input class="input" data-new-cat-name maxlength="24" placeholder="اسم التصنيف" style="flex:1;min-width:120px" aria-label="اسم التصنيف الجديد">
            <button type="button" class="btn btn-primary" data-action="save-inline-category">إضافة</button>
          </div>
          <p class="field-error" data-error-for="categoryId"></p>
        </fieldset>
        ${C.textField({ name: 'description', label: 'الوصف (اختياري)', value: expense?.description || '', placeholder: 'مثال: غداء مع الأصدقاء', maxlength: 120 })}
        <div class="grid-2">
          ${C.dateField({ name: 'date', label: 'التاريخ', value: expense?.date || today, min: first.start, max: today })}
          ${C.selectField({
            name: 'account', label: 'الدفع من', value: expense?.account || 'main',
            options: [
              { value: 'main', label: 'الحساب الرئيسي' },
              { value: 'extra', label: `الأموال الإضافية (${Utils.money(bal.extra + (isEdit && expense.account === 'extra' ? expense.amount : 0))})` },
            ],
          })}
        </div>
        <p class="field-hint">المصروفات من الحساب الرئيسي فقط تُحتسب في الميزانية اليومية.</p>
        ${C.formActions(isEdit ? 'حفظ التعديل' : 'إضافة المصروف')}
      </form>`;
    UI.modal({ title: isEdit ? 'تعديل مصروف' : 'إضافة مصروف', body });
  },

  categoryChips(selectedId) {
    return state.categories.map((c) => `
      <label class="chip-radio">
        <input type="radio" name="categoryId" value="${c.id}" ${c.id === selectedId ? 'checked' : ''}>
        <span>${c.icon} ${Utils.escape(c.name)}</span>
      </label>`).join('') + '<button type="button" class="chip-add" data-action="toggle-inline-category">+ تصنيف جديد</button>';
  },

  submitExpense(form) {
    const first = Data.firstMonth();
    const today = DateUtils.today();
    const { values, ok } = Forms.validate(form, {
      amount: (v) => Forms.amount(v),
      categoryId: (v) => (state.categories.some((c) => c.id === v) ? { value: v } : { error: 'اختر تصنيفًا.' }),
      description: (v) => Forms.text(v, { max: 120, label: 'الوصف' }),
      date: (v) => Forms.date(v, { min: first.start, max: today }),
      account: (v) => (['main', 'extra'].includes(v) ? { value: v } : { error: 'اختر الحساب.' }),
    });
    if (!ok) return;

    const id = form.querySelector('[name="id"]').value;
    const existing = id ? state.transactions.find((t) => t.id === id) : null;

    // التحقق من كفاية الأموال الإضافية
    if (values.account === 'extra') {
      const neg = Calc.wouldGoNegative((copy) => {
        if (existing) {
          const t = copy.transactions.find((x) => x.id === id);
          Object.assign(t, values);
        } else {
          copy.transactions.push({ type: 'expense', ...values });
        }
      });
      if (neg) {
        Forms.showErrors(form, { amount: `رصيد الأموال الإضافية لا يكفي.` });
        return;
      }
    }

    if (existing) {
      Object.assign(existing, values, { updatedAt: new Date().toISOString() });
      UI.toast('تم تعديل المصروف');
    } else {
      state.transactions.push({ id: Utils.uid('tx_'), type: 'expense', ...values, createdAt: new Date().toISOString() });
      const month = Data.monthForDate(values.date);
      Store.save('transactions');
      if (month && values.date === today && values.account === 'main') {
        const row = Calc.monthBudget(month).rows.find((r) => r.isToday);
        const st = row ? Calc.status(row.allowance, row.spent) : 'good';
        const left = row ? row.allowance - row.spent : 0;
        UI.toast(st === 'over' ? `تمت الإضافة — تجاوزت ميزانية اليوم بمبلغ ${Utils.money(-left)}` : `تمت الإضافة — المتبقي اليوم ${Utils.money(left)}`, st === 'over' ? 'warn' : 'success');
      } else {
        UI.toast('تمت إضافة المصروف');
      }
    }
    Store.save('transactions');
    UI.closeModal();
    App.render();
  },

  /* ---------- نموذج المصروف الشهري ---------- */
  openFixed(item = null) {
    const isEdit = !!item;
    const icon = item?.icon || '🏠';
    const body = `
      <form class="form" data-form="fixed" novalidate>
        <input type="hidden" name="id" value="${isEdit ? item.id : ''}">
        ${C.textField({ name: 'name', label: 'اسم المصروف', value: item?.name || '', placeholder: 'مثال: قسط البيت، الإيجار، الكهرباء', maxlength: 40 })}
        ${C.amountField({ name: 'amount', label: 'المبلغ الشهري', value: isEdit ? item.amount : '' })}
        ${C.integerField({ name: 'dueDay', label: 'يوم الاستحقاق (اختياري)', value: item?.dueDay ? String(item.dueDay) : '', min: 1, max: 31, placeholder: 'مثال: 1' })}
        <fieldset class="field">
          <legend class="label">الرمز</legend>
          <div class="chips">
            ${FIXED_ICONS.map((ic) => `<label class="chip-radio"><input type="radio" name="icon" value="${ic}" ${ic === icon ? 'checked' : ''}><span style="font-size:18px;padding:6px 10px">${ic}</span></label>`).join('')}
          </div>
        </fieldset>
        ${C.formActions(isEdit ? 'حفظ التعديل' : 'إضافة')}
      </form>`;
    UI.modal({ title: isEdit ? 'تعديل مصروف شهري' : 'إضافة مصروف شهري', body });
  },

  submitFixed(form) {
    const { values, ok } = Forms.validate(form, {
      name: (v) => Forms.text(v, { required: true, max: 40, label: 'الاسم' }),
      amount: (v) => Forms.amount(v),
      dueDay: (v) => (String(v || '').trim() === '' ? { value: null } : Forms.integer(v, { min: 1, max: 31, label: 'يوم الاستحقاق' })),
      icon: (v) => ({ value: FIXED_ICONS.includes(v) ? v : '📌' }),
    });
    if (!ok) return;
    const id = form.querySelector('[name="id"]').value;
    const existing = id ? state.fixedExpenses.find((f) => f.id === id) : null;
    if (existing) {
      Object.assign(existing, values);
      // تحديث مبلغ الشهر الحالي أيضًا
      UI.toast('تم تعديل المصروف الشهري');
    } else {
      state.fixedExpenses.push({ id: Utils.uid('fx_'), ...values, createdAt: new Date().toISOString() });
      UI.toast('تمت إضافة المصروف الشهري');
    }
    Months.syncCurrentFixed();
    Store.save('fixedExpenses', 'months');
    UI.closeModal();
    App.render();
  },

  /* ---------- الأموال الإضافية ---------- */
  openExtra(entry = null) {
    const isEdit = !!entry;
    const today = DateUtils.today();
    const type = entry?.type || 'bonus';
    const body = `
      <form class="form" data-form="extra" novalidate>
        <input type="hidden" name="id" value="${isEdit ? entry.id : ''}">
        ${C.amountField({ name: 'amount', label: 'المبلغ', value: isEdit ? entry.amount : '', big: true, autofocus: true })}
        <fieldset class="field">
          <legend class="label">النوع</legend>
          <div class="chips">
            ${EXTRA_TYPES.map((t) => `<label class="chip-radio"><input type="radio" name="type" value="${t.id}" ${t.id === type ? 'checked' : ''}><span>${t.icon} ${t.name}</span></label>`).join('')}
          </div>
        </fieldset>
        ${C.textField({ name: 'description', label: 'الوصف (اختياري)', value: entry?.description || '', placeholder: 'مثال: مكافأة نهاية السنة', maxlength: 80 })}
        ${C.dateField({ name: 'date', label: 'التاريخ', value: entry?.date || today, max: today })}
        ${C.formActions(isEdit ? 'حفظ التعديل' : 'إضافة')}
      </form>`;
    UI.modal({ title: isEdit ? 'تعديل مبلغ إضافي' : 'إضافة مبلغ إضافي', body });
  },

  submitExtra(form) {
    const today = DateUtils.today();
    const { values, ok } = Forms.validate(form, {
      amount: (v) => Forms.amount(v),
      type: (v) => ({ value: EXTRA_TYPES.some((t) => t.id === v) ? v : 'other' }),
      description: (v) => Forms.text(v, { max: 80, label: 'الوصف' }),
      date: (v) => Forms.date(v, { max: today }),
    });
    if (!ok) return;
    const id = form.querySelector('[name="id"]').value;
    const existing = id ? state.extraIncome.find((e) => e.id === id) : null;
    if (existing) {
      const neg = Calc.wouldGoNegative((copy) => { Object.assign(copy.extraIncome.find((e) => e.id === id), values); });
      if (neg) {
        Forms.showErrors(form, { amount: 'لا يمكن تقليل المبلغ لأنك استخدمت جزءًا منه بالفعل.' });
        return;
      }
      Object.assign(existing, values);
      UI.toast('تم التعديل');
    } else {
      state.extraIncome.push({ id: Utils.uid('ex_'), ...values, createdAt: new Date().toISOString() });
      UI.toast(`تمت إضافة ${Utils.money(values.amount)} إلى الأموال الإضافية`);
    }
    Store.save('extraIncome');
    UI.closeModal();
    App.render();
  },

  /* ---------- التحويلات (إيداع / سحب / نقل) ---------- */
  /**
   * mode: deposit (إلى صندوق) | withdraw (من صندوق) | extraMain | extraFund
   */
  openTransfer({ mode, fundId = null }) {
    const bal = Calc.balances();
    const today = DateUtils.today();
    const fund = fundId ? Data.fund(fundId) : null;
    let title = '';
    let fields = '';
    let hint = '';

    if (mode === 'deposit') {
      title = `إيداع في ${fund.name}`;
      fields = C.selectField({
        name: 'from', label: 'من حساب', value: 'main',
        options: [
          { value: 'main', label: `الحساب الرئيسي (${Utils.money(bal.main)})` },
          { value: 'extra', label: `الأموال الإضافية (${Utils.money(bal.extra)})` },
        ],
      }) + `<input type="hidden" name="to" value="${fund.id}">`;
      hint = 'سيتم خصم المبلغ من الحساب المختار وإضافته للصندوق. لن تتأثر ميزانيتك اليومية.';
    } else if (mode === 'withdraw') {
      title = `سحب من ${fund.name}`;
      fields = `<input type="hidden" name="from" value="${fund.id}">` + C.selectField({
        name: 'to', label: 'إلى', value: 'main',
        options: [
          { value: 'main', label: 'الحساب الرئيسي' },
          { value: 'extra', label: 'الأموال الإضافية' },
          { value: 'external', label: 'سحب خارجي (صرف مباشر)' },
        ],
      });
      hint = `الرصيد الحالي للصندوق: ${Utils.money(bal[fund.id])}`;
    } else if (mode === 'extraMain') {
      title = 'نقل إلى الحساب الرئيسي';
      fields = '<input type="hidden" name="from" value="extra"><input type="hidden" name="to" value="main">';
      hint = `الرصيد الإضافي المتاح: ${Utils.money(bal.extra)}`;
    } else if (mode === 'extraFund') {
      title = 'نقل إلى صندوق';
      fields = '<input type="hidden" name="from" value="extra">' + C.selectField({
        name: 'to', label: 'إلى صندوق', value: 'emergency',
        options: state.funds.map((f) => ({ value: f.id, label: f.name })),
      });
      hint = `الرصيد الإضافي المتاح: ${Utils.money(bal.extra)}`;
    }

    const body = `
      <form class="form" data-form="transfer" novalidate>
        <input type="hidden" name="mode" value="${mode}">
        ${C.amountField({ name: 'amount', label: 'المبلغ', big: true, autofocus: true, hint })}
        ${fields}
        ${mode === 'extraMain' ? `
          <label class="check-row">
            <input type="checkbox" name="affectsBudget" value="1">
            <span><b>إضافة المبلغ إلى ميزانية المصروف اليومي لهذا الشهر</b><br><span class="muted">إذا لم تفعل ذلك سيزيد رصيد الحساب الرئيسي فقط دون تغيير الميزانية اليومية.</span></span>
          </label>` : ''}
        ${C.textField({ name: 'note', label: 'ملاحظة (اختياري)', maxlength: 80 })}
        ${C.dateField({ name: 'date', label: 'التاريخ', value: today, max: today })}
        ${C.formActions('تنفيذ')}
      </form>`;
    UI.modal({ title, body });
  },

  submitTransfer(form) {
    const today = DateUtils.today();
    const validAccounts = ['main', 'extra', 'external', ...state.funds.map((f) => f.id)];
    const { values, ok } = Forms.validate(form, {
      amount: (v) => Forms.amount(v),
      from: (v) => (validAccounts.includes(v) && v !== 'external' ? { value: v } : { error: 'حساب غير صحيح.' }),
      to: (v) => (validAccounts.includes(v) ? { value: v } : { error: 'حساب غير صحيح.' }),
      note: (v) => Forms.text(v, { max: 80, label: 'الملاحظة' }),
      date: (v) => Forms.date(v, { min: Data.firstMonth().start, max: today }),
    });
    if (!ok) return;
    if (values.from === values.to) {
      Forms.showErrors(form, { to: 'لا يمكن التحويل لنفس الحساب.' });
      return;
    }
    const bal = Calc.balances();
    const available = bal[values.from];
    if (values.amount > available + 0.004) {
      Forms.showErrors(form, { amount: `الرصيد غير كافٍ. المتاح: ${Utils.money(Math.max(0, available))}` });
      return;
    }
    const mode = form.querySelector('[name="mode"]').value;
    const affectsBudget = mode === 'extraMain' && !!form.querySelector('[name="affectsBudget"]')?.checked;
    state.transactions.push({
      id: Utils.uid('tr_'),
      type: 'transfer',
      kind: mode === 'withdraw' ? 'withdraw' : 'transfer',
      from: values.from,
      to: values.to,
      amount: values.amount,
      note: values.note,
      date: values.date,
      affectsBudget,
      createdAt: new Date().toISOString(),
    });
    Store.save('transactions');
    UI.closeModal();
    const msg = mode === 'withdraw'
      ? `تم سحب ${Utils.money(values.amount)} من ${Data.accountLabel(values.from)}`
      : `تم تحويل ${Utils.money(values.amount)} إلى ${Data.accountLabel(values.to)}`;
    UI.toast(msg);
    App.render();
  },

  /* ---------- تعديل راتب وهدف شهر محدد ---------- */
  openMonthEdit(month) {
    const body = `
      <form class="form" data-form="month" novalidate>
        <input type="hidden" name="id" value="${month.id}">
        <p class="section-sub">${DateUtils.range(month.start, month.end)}</p>
        ${C.amountField({ name: 'salary', label: 'راتب هذا الشهر', value: month.salary, allowZero: true })}
        ${C.amountField({ name: 'retainTarget', label: 'المبلغ المستهدف لهذا الشهر', value: month.retainTarget, required: false })}
        ${C.amountField({ name: 'priorSpent', label: 'مصروف سابق غير مسجل (اختياري)', value: month.priorSpent || '', required: false, hint: 'مبلغ صرفته في هذا الشهر قبل بدء التسجيل في التطبيق' })}
        <p class="field-hint">التعديل هنا يخص هذا الشهر فقط ولا يغيّر الإعدادات العامة.</p>
        ${C.formActions('حفظ')}
      </form>`;
    UI.modal({ title: 'تعديل بيانات الشهر', body });
  },

  submitMonth(form) {
    const { values, ok } = Forms.validate(form, {
      salary: (v) => Forms.amount(v, { allowZero: true }),
      retainTarget: (v) => Forms.amount(v, { required: false, allowZero: true }),
      priorSpent: (v) => Forms.amount(v, { required: false, allowZero: true }),
    });
    if (!ok) return;
    const month = Data.monthById(form.querySelector('[name="id"]').value);
    if (!month) return;
    Object.assign(month, values);
    Store.save('months');
    UI.closeAllModals();
    UI.toast('تم تحديث بيانات الشهر');
    App.render();
  },

  /* ---------- إعدادات الصندوق ---------- */
  openFund(fund) {
    const body = `
      <form class="form" data-form="fund" novalidate>
        <input type="hidden" name="id" value="${fund.id}">
        ${C.textField({ name: 'name', label: 'اسم الصندوق', value: fund.name, maxlength: 30 })}
        ${C.textField({ name: 'description', label: 'وصف مختصر', value: fund.description || '', maxlength: 60 })}
        ${C.amountField({ name: 'goal', label: 'الهدف (اختياري)', value: fund.goal || '', required: false, hint: 'المبلغ الذي تريد الوصول إليه في هذا الصندوق' })}
        ${C.amountField({ name: 'initialBalance', label: 'الرصيد الافتتاحي', value: fund.initialBalance || '', required: false, hint: 'المبلغ الموجود في الصندوق قبل استخدام التطبيق' })}
        ${C.formActions('حفظ')}
      </form>`;
    UI.modal({ title: 'إعدادات الصندوق', body });
  },

  submitFund(form) {
    const { values, ok } = Forms.validate(form, {
      name: (v) => Forms.text(v, { required: true, max: 30, label: 'الاسم' }),
      description: (v) => Forms.text(v, { max: 60, label: 'الوصف' }),
      goal: (v) => Forms.amount(v, { required: false, allowZero: true }),
      initialBalance: (v) => Forms.amount(v, { required: false, allowZero: true }),
    });
    if (!ok) return;
    const fund = Data.fund(form.querySelector('[name="id"]').value);
    if (!fund) return;
    // التأكد أن تقليل الرصيد الافتتاحي لا يجعل الصندوق سالبًا
    const current = Calc.balances()[fund.id];
    const after = current - (fund.initialBalance || 0) + values.initialBalance;
    if (after < -0.004) {
      Forms.showErrors(form, { initialBalance: 'هذا الرصيد الافتتاحي سيجعل رصيد الصندوق سالبًا بسبب عمليات السحب المسجلة.' });
      return;
    }
    Object.assign(fund, values);
    Store.save('funds');
    UI.closeModal();
    UI.toast('تم حفظ إعدادات الصندوق');
    App.render();
  },

  /* ---------- الإعداد الأولي ---------- */
  submitSetup(form) {
    const { values, ok } = Forms.validate(form, {
      salary: (v) => Forms.amount(v),
      payday: (v) => Forms.integer(v, { min: 1, max: 31, label: 'يوم الراتب' }),
      retainTarget: (v) => Forms.amount(v, { required: false, allowZero: true }),
      emergency: (v) => Forms.amount(v, { required: false, allowZero: true }),
      investment: (v) => Forms.amount(v, { required: false, allowZero: true }),
      priorSpent: (v) => Forms.amount(v, { required: false, allowZero: true }),
      openingBalance: (v) => Forms.amount(v, { required: false, allowZero: true }),
    });
    if (!ok) return;
    if (values.retainTarget >= values.salary) {
      Forms.showErrors(form, { retainTarget: 'المبلغ المستهدف يجب أن يكون أقل من الراتب.' });
      return;
    }
    if (values.priorSpent > values.salary) {
      Forms.showErrors(form, { priorSpent: 'المبلغ أكبر من الراتب.' });
      return;
    }
    Object.assign(state.settings, {
      salary: values.salary,
      payday: values.payday,
      retainTarget: values.retainTarget,
      openingBalance: values.openingBalance,
      setupDone: true,
      createdAt: new Date().toISOString(),
    });
    Data.fund('emergency').initialBalance = values.emergency;
    Data.fund('investment').initialBalance = values.investment;
    Store.save();
    Months.ensure();
    // بدء التسجيل من اليوم إذا كان الإعداد في منتصف الشهر المالي
    const first = Data.currentMonth();
    const today = DateUtils.today();
    if (first && today > first.start) first.trackFrom = today;
    if (first) first.priorSpent = values.priorSpent;
    Store.save('months');
    UI.toast('تم إنشاء حسابك. أضف مصاريفك الشهرية الثابتة للحصول على ميزانية دقيقة.', 'success', 4500);
    location.hash = '#fixed';
    App.render();
  },

  /* ---------- الإعدادات ---------- */
  async submitSettings(form) {
    const { values, ok } = Forms.validate(form, {
      salary: (v) => Forms.amount(v),
      payday: (v) => Forms.integer(v, { min: 1, max: 31, label: 'يوم الراتب' }),
      retainTarget: (v) => Forms.amount(v, { required: false, allowZero: true }),
      openingBalance: (v) => Forms.amount(v, { required: false, allowZero: true }),
      rolloverMode: (v) => ({ value: v === 'spread' ? 'spread' : 'nextDay' }),
      warnThreshold: (v) => Forms.integer(v, { min: 50, max: 99, label: 'نسبة التنبيه' }),
    });
    if (!ok) return;
    if (values.retainTarget >= values.salary) {
      Forms.showErrors(form, { retainTarget: 'المبلغ المستهدف يجب أن يكون أقل من الراتب.' });
      return;
    }

    const s = state.settings;
    const month = Data.currentMonth();
    if (values.payday !== s.payday) {
      const confirmed = await UI.confirm({
        title: 'تغيير يوم الراتب',
        message: `سيتم تعديل نهاية الشهر المالي الحالي لتتوافق مع يوم الراتب الجديد (${values.payday}). الشهور السابقة لن تتغير.`,
        confirmText: 'تغيير',
      });
      if (!confirmed) return;
    }

    const paydayChanged = values.payday !== s.payday;
    Object.assign(s, values);

    if (month) {
      month.salary = values.salary;
      month.retainTarget = values.retainTarget;
      if (paydayChanged) month.end = Periods.endFor(month.start, values.payday);
    }
    Store.save('settings', 'months');
    Months.ensure();
    UI.toast('تم حفظ الإعدادات');
    App.render();
  },

  submitCategory(form, { icon, name }) {
    const cleanName = Forms.text(name, { required: true, max: 24, label: 'اسم التصنيف' });
    if (cleanName.error) { UI.toast(cleanName.error, 'error'); return null; }
    if (state.categories.some((c) => c.name === cleanName.value)) { UI.toast('هذا التصنيف موجود بالفعل.', 'error'); return null; }
    const cleanIcon = String(icon || '').trim().slice(0, 4) || '🏷️';
    const cat = { id: Utils.uid('cat_'), name: cleanName.value, icon: cleanIcon, builtIn: false };
    state.categories.splice(state.categories.length - 1, 0, cat); // قبل "أخرى"
    Store.save('categories');
    UI.toast(`تمت إضافة تصنيف "${cat.name}"`);
    return cat;
  },
};

/* =========================================================
   11. Actions — جميع أزرار التطبيق (data-action)
   ========================================================= */
const Actions = {
  'add-expense'() {
    if (!state.settings.setupDone) return;
    Forms.openExpense();
  },

  'edit-expense'({ id }) {
    const t = state.transactions.find((x) => x.id === id);
    if (t) Forms.openExpense(t);
  },

  async 'delete-expense'({ id }) {
    const t = state.transactions.find((x) => x.id === id);
    if (!t) return;
    const cat = Data.category(t.categoryId);
    const ok = await UI.confirm({
      title: 'حذف المصروف',
      message: `هل تريد حذف مصروف "${Utils.escape(t.description || cat.name)}" بقيمة <b>${Utils.money(t.amount)}</b>؟ سيُعاد حساب الميزانية اليومية.`,
      confirmText: 'حذف', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.transactions = state.transactions.filter((x) => x.id !== id);
    Store.save('transactions');
    UI.toast('تم حذف المصروف');
    App.render();
  },

  'close-modal'() { UI.closeModal(); },

  'toggle-inline-category'(_, el) {
    const panel = el.closest('form').querySelector('[data-inline-cat]');
    panel.classList.toggle('is-open');
    if (panel.classList.contains('is-open')) panel.querySelector('[data-new-cat-name]').focus();
  },

  'save-inline-category'(_, el) {
    const form = el.closest('form');
    const panel = form.querySelector('[data-inline-cat]');
    const cat = Forms.submitCategory(form, {
      icon: panel.querySelector('[data-new-cat-icon]').value,
      name: panel.querySelector('[data-new-cat-name]').value,
    });
    if (!cat) return;
    form.querySelector('[data-cat-chips]').innerHTML = Forms.categoryChips(cat.id);
    panel.classList.remove('is-open');
    panel.querySelectorAll('input').forEach((i) => { i.value = ''; });
  },

  async 'delete-category'({ id }) {
    const cat = state.categories.find((c) => c.id === id);
    if (!cat || id === 'other') return;
    const count = Data.expenses().filter((t) => t.categoryId === id).length;
    const ok = await UI.confirm({
      title: 'حذف التصنيف',
      message: `هل تريد حذف تصنيف "${Utils.escape(cat.name)}"؟${count ? ` سيتم نقل ${count} مصروف إلى تصنيف "أخرى".` : ''}`,
      confirmText: 'حذف', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.transactions.forEach((t) => { if (t.type === 'expense' && t.categoryId === id) t.categoryId = 'other'; });
    state.categories = state.categories.filter((c) => c.id !== id);
    if (state.ui.filters.category === id) state.ui.filters.category = 'all';
    Store.save('categories', 'transactions');
    UI.toast('تم حذف التصنيف');
    App.render();
  },

  'add-fixed'() { Forms.openFixed(); },

  'edit-fixed'({ id }) {
    const f = state.fixedExpenses.find((x) => x.id === id);
    if (f) Forms.openFixed(f);
  },

  async 'delete-fixed'({ id }) {
    const f = state.fixedExpenses.find((x) => x.id === id);
    if (!f) return;
    const ok = await UI.confirm({
      title: 'حذف مصروف شهري',
      message: `هل تريد حذف "${Utils.escape(f.name)}" من المصاريف الشهرية؟ لن يُضاف في الشهور القادمة. إذا كان مدفوعًا هذا الشهر سيبقى مسجلًا.`,
      confirmText: 'حذف', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.fixedExpenses = state.fixedExpenses.filter((x) => x.id !== id);
    Months.syncCurrentFixed();
    Store.save('fixedExpenses', 'months');
    UI.toast('تم الحذف');
    App.render();
  },

  'toggle-fixed-paid'({ month: monthId, id }) {
    const month = Data.monthById(monthId);
    const item = month?.fixedItems.find((i) => i.id === id);
    if (!item) return;
    item.paid = !item.paid;
    item.paidDate = item.paid ? DateUtils.today() : null;
    Store.save('months');
    UI.toast(item.paid ? `تم دفع ${item.name} — خُصم ${Utils.money(item.amount)} من الحساب الرئيسي` : `تم التراجع عن دفع ${item.name}`, item.paid ? 'success' : 'info');
    App.render();
    // تحديث نافذة تفاصيل الشهر إن كانت مفتوحة
    const top = UI.topModal();
    if (top && top.dataset.monthId === monthId) {
      top.querySelector('.modal-body').innerHTML = Pages.monthDetails(month);
    }
  },

  'fund-deposit'({ id }) { Forms.openTransfer({ mode: 'deposit', fundId: id }); },

  'fund-withdraw'({ id }) {
    if (Calc.balances()[id] <= 0) { UI.toast('رصيد الصندوق صفر.', 'error'); return; }
    Forms.openTransfer({ mode: 'withdraw', fundId: id });
  },

  'edit-fund'({ id }) {
    const fund = Data.fund(id);
    if (fund) Forms.openFund(fund);
  },

  'add-extra'() { Forms.openExtra(); },

  'edit-extra'({ id }) {
    const e = state.extraIncome.find((x) => x.id === id);
    if (e) Forms.openExtra(e);
  },

  async 'delete-extra'({ id }) {
    const e = state.extraIncome.find((x) => x.id === id);
    if (!e) return;
    const neg = Calc.wouldGoNegative((copy) => { copy.extraIncome = copy.extraIncome.filter((x) => x.id !== id); });
    if (neg) {
      UI.toast('لا يمكن حذف هذا المبلغ لأنك استخدمته بالفعل. احذف عمليات النقل أو الصرف المرتبطة أولًا.', 'error', 5000);
      return;
    }
    const ok = await UI.confirm({
      title: 'حذف مبلغ إضافي',
      message: `هل تريد حذف "${Utils.escape(e.description || Data.extraType(e.type).name)}" بقيمة <b>${Utils.money(e.amount)}</b>؟`,
      confirmText: 'حذف', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.extraIncome = state.extraIncome.filter((x) => x.id !== id);
    Store.save('extraIncome');
    UI.toast('تم الحذف');
    App.render();
  },

  'extra-move'({ to }) {
    if (Calc.balances().extra <= 0) { UI.toast('لا يوجد رصيد إضافي متاح.', 'error'); return; }
    Forms.openTransfer({ mode: to === 'main' ? 'extraMain' : 'extraFund' });
  },

  async 'delete-transfer'({ id }) {
    const t = state.transactions.find((x) => x.id === id);
    if (!t) return;
    const neg = Calc.wouldGoNegative((copy) => { copy.transactions = copy.transactions.filter((x) => x.id !== id); });
    if (neg) {
      UI.toast(`لا يمكن حذف هذه العملية لأن رصيد "${Data.accountLabel(neg.account)}" سيصبح سالبًا.`, 'error', 5000);
      return;
    }
    const ok = await UI.confirm({
      title: 'إلغاء العملية',
      message: `سيتم إلغاء عملية ${Utils.escape(Data.accountLabel(t.from))} ← ${Utils.escape(Data.accountLabel(t.to))} بقيمة <b>${Utils.money(t.amount)}</b> وإعادة الأرصدة كما كانت.`,
      confirmText: 'إلغاء العملية', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.transactions = state.transactions.filter((x) => x.id !== id);
    Store.save('transactions');
    UI.toast('تم إلغاء العملية');
    App.render();
  },

  'open-month'({ id }) {
    const month = Data.monthById(id);
    if (!month) return;
    const layer = UI.modal({ title: `الشهر المالي: ${DateUtils.range(month.start, month.end)}`, body: Pages.monthDetails(month), wide: true });
    layer.dataset.monthId = month.id;
  },

  'edit-month'({ id }) {
    const month = Data.monthById(id);
    if (month) Forms.openMonthEdit(month);
  },

  async 'delete-month'({ id }) {
    const month = Data.monthById(id);
    if (!month) return;
    const ok = await UI.confirm({
      title: 'حذف الشهر',
      message: `سيتم حذف الشهر ${DateUtils.range(month.start, month.end)} وراتبه ومصاريفه الثابتة من السجل.`,
      confirmText: 'حذف', danger: true, icon: 'trash',
    });
    if (!ok) return;
    state.months = state.months.filter((m) => m.id !== id);
    Store.save('months');
    UI.closeAllModals();
    UI.toast('تم حذف الشهر');
    App.render();
  },

  async 'add-prev-month'() {
    const first = Data.firstMonth();
    if (!first) return;
    const end = DateUtils.addDays(first.start, -1);
    const period = Periods.containing(end, state.settings.payday);
    const ok = await UI.confirm({
      title: 'إضافة شهر سابق',
      message: `سيتم إضافة الشهر ${DateUtils.range(period.start, end)} براتب ${Utils.money(state.settings.salary)} لتتمكن من تسجيل مصروفاته. سيُضاف راتبه إلى رصيد الحساب الرئيسي.`,
      confirmText: 'إضافة',
    });
    if (!ok) return;
    const m = Months.prependPrevious();
    UI.toast(m ? 'تمت إضافة الشهر السابق' : 'تعذّرت إضافة الشهر', m ? 'success' : 'error');
    App.render();
  },

  'quick-range'({ range }) {
    const f = state.ui.filters;
    const month = Data.currentMonth();
    if (range === 'today') { f.from = DateUtils.today(); f.to = DateUtils.today(); }
    else if (range === 'month' && month) { f.from = month.start; f.to = month.end; }
    else { f.from = ''; f.to = ''; }
    state.ui.listLimit = 60;
    App.render();
  },

  'clear-filters'() {
    state.ui.filters = { q: '', category: 'all', account: 'all', from: '', to: '' };
    state.ui.listLimit = 60;
    App.render();
  },

  'load-more'() {
    state.ui.listLimit += 60;
    Pages.renderExpenseList();
  },

  'toggle-theme'() {
    const current = document.documentElement.getAttribute('data-theme');
    state.settings.theme = current === 'dark' ? 'light' : 'dark';
    Store.save('settings');
    UI.applyTheme();
    if (Router.current() === 'settings') App.render();
  },

  'set-theme'({ theme }) {
    state.settings.theme = ['light', 'dark', 'auto'].includes(theme) ? theme : 'auto';
    Store.save('settings');
    UI.applyTheme();
    App.render();
  },

  'open-more'() {
    const current = Router.current();
    const items = ROUTES.filter((r) => !['dashboard', 'expenses', 'funds'].includes(r.id));
    const body = `
      <nav class="more-grid" aria-label="المزيد من الصفحات">
        ${items.map((r) => `<a href="#${r.id}" class="more-item ${r.id === current ? 'is-active' : ''}" data-close-on-nav>${Utils.icon(r.icon)} ${r.title}</a>`).join('')}
      </nav>`;
    UI.modal({ title: 'المزيد', body });
  },

  export() { Backup.export(); },
  import() { Backup.pickFile(); },

  async 'reset-all'() {
    const ok = await UI.confirm({
      title: 'حذف جميع البيانات',
      message: '<b>تحذير: هذه العملية نهائية ولا يمكن التراجع عنها.</b><br>سيتم حذف جميع الشهور والمصروفات والمصاريف الشهرية والأموال الإضافية والصناديق والإعدادات من هذا المتصفح. ننصحك بتصدير نسخة احتياطية أولًا.',
      confirmText: 'حذف كل البيانات نهائيًا', danger: true, requireText: 'حذف',
    });
    if (!ok) return;
    Store.clearAll();
    UI.closeAllModals();
    UI.applyTheme();
    location.hash = '#dashboard';
    App.render();
    UI.toast('تم حذف جميع البيانات', 'info');
  },

  async 'load-demo'() {
    const ok = await UI.confirm({
      title: 'بيانات تجريبية',
      message: 'سيتم إنشاء بيانات تجريبية (راتب 15,000 ر.س، مصاريف شهرية، مصروفات، صناديق) لتجربة التطبيق. يمكنك حذفها لاحقًا من الإعدادات.',
      confirmText: 'إنشاء البيانات',
    });
    if (!ok) return;
    Demo.load();
    UI.toast('تم تحميل البيانات التجريبية');
    location.hash = '#dashboard';
    App.render();
  },
};

/* =========================================================
   12. Backup — تصدير واستيراد JSON
   ========================================================= */
const Backup = {
  export() {
    try {
      const json = JSON.stringify(Store.exportData(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = BACKUP_FILENAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      UI.toast(`تم تصدير البيانات إلى ${BACKUP_FILENAME}`);
    } catch (err) {
      console.error(err);
      UI.toast('تعذّر تصدير البيانات.', 'error');
    }
  },

  pickFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (file) Backup.readFile(file);
    });
    input.click();
  },

  readFile(file) {
    if (file.size > 20 * 1024 * 1024) { UI.toast('حجم الملف كبير جدًا.', 'error'); return; }
    const reader = new FileReader();
    reader.onerror = () => UI.toast('تعذّرت قراءة الملف.', 'error');
    reader.onload = async () => {
      let data;
      try {
        data = Backup.sanitize(JSON.parse(String(reader.result)));
      } catch (err) {
        console.error(err);
        UI.toast(err && err.userMessage ? err.userMessage : 'الملف غير صالح أو تالف.', 'error', 5000);
        return;
      }
      const ok = await UI.confirm({
        title: 'استيراد البيانات',
        message: `يحتوي الملف على ${data.months.length} شهر و ${data.transactions.filter((t) => t.type === 'expense').length} مصروف.<br><b>سيتم استبدال جميع البيانات الحالية</b> بمحتوى الملف.`,
        confirmText: 'استيراد واستبدال', danger: true, icon: 'upload',
      });
      if (!ok) return;
      Object.assign(state, data);
      Store.sortMonths();
      Store.save();
      Months.ensure();
      UI.applyTheme();
      UI.toast('تمت استعادة البيانات بنجاح');
      location.hash = '#dashboard';
      App.render();
    };
    reader.readAsText(file);
  },

  /** التحقق من ملف النسخة الاحتياطية وتنظيفه */
  sanitize(raw) {
    const fail = (msg) => { const e = new Error(msg); e.userMessage = msg; throw e; };
    if (!Utils.isPlainObject(raw)) fail('صيغة الملف غير صحيحة.');
    const src = Utils.isPlainObject(raw.data) ? raw.data : raw;
    if (!Utils.isPlainObject(src.settings)) fail('الملف لا يحتوي على إعدادات صالحة لتطبيق إدارة المال.');

    const isoOk = (v) => DateUtils.isValidISO(v);
    const amt = (v) => Utils.safeAmount(v, NaN);
    const str = (v, max) => String(v ?? '').slice(0, max);

    const s = src.settings;
    const settings = {
      ...DEFAULT_SETTINGS,
      salary: Utils.safeAmount(s.salary),
      payday: Number.isInteger(s.payday) && s.payday >= 1 && s.payday <= 31 ? s.payday : 27,
      retainTarget: Utils.safeAmount(s.retainTarget),
      openingBalance: Utils.safeAmount(s.openingBalance),
      rolloverMode: s.rolloverMode === 'spread' ? 'spread' : 'nextDay',
      warnThreshold: Number.isInteger(s.warnThreshold) && s.warnThreshold >= 50 && s.warnThreshold <= 99 ? s.warnThreshold : 80,
      theme: ['light', 'dark', 'auto'].includes(s.theme) ? s.theme : 'auto',
      setupDone: !!s.setupDone,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : null,
    };

    const arr = (v) => (Array.isArray(v) ? v : []);

    const categories = arr(src.categories)
      .filter((c) => Utils.isPlainObject(c) && typeof c.id === 'string' && c.name)
      .map((c) => ({ id: str(c.id, 40), name: str(c.name, 24), icon: str(c.icon, 4) || '🏷️', builtIn: !!c.builtIn }));
    if (!categories.some((c) => c.id === 'other')) categories.push(Utils.clone(DEFAULT_CATEGORIES.at(-1)));
    const catIds = new Set(categories.map((c) => c.id));

    const fixedExpenses = arr(src.fixedExpenses)
      .filter((f) => Utils.isPlainObject(f) && f.id && f.name && Number.isFinite(amt(f.amount)))
      .map((f) => ({ id: str(f.id, 40), name: str(f.name, 40), amount: amt(f.amount), icon: str(f.icon, 4) || '📌', dueDay: Number.isInteger(f.dueDay) ? f.dueDay : null, createdAt: f.createdAt || null }));

    const months = arr(src.months)
      .filter((m) => Utils.isPlainObject(m) && isoOk(m.start) && isoOk(m.end) && m.end >= m.start)
      .map((m) => ({
        id: 'm_' + m.start,
        start: m.start,
        end: m.end,
        salary: Utils.safeAmount(m.salary),
        retainTarget: Utils.safeAmount(m.retainTarget),
        trackFrom: isoOk(m.trackFrom) ? m.trackFrom : null,
        priorSpent: Utils.safeAmount(m.priorSpent),
        fixedItems: arr(m.fixedItems)
          .filter((i) => Utils.isPlainObject(i) && i.id && Number.isFinite(amt(i.amount)))
          .map((i) => ({ id: str(i.id, 40), name: str(i.name, 40), icon: str(i.icon, 4) || '📌', amount: amt(i.amount), dueDay: Number.isInteger(i.dueDay) ? i.dueDay : null, paid: !!i.paid, paidDate: isoOk(i.paidDate) ? i.paidDate : null })),
        createdAt: m.createdAt || null,
      }));

    // إزالة الشهور المكررة أو المتداخلة
    months.sort((a, b) => a.start.localeCompare(b.start));
    const cleanMonths = [];
    months.forEach((m) => { const prev = cleanMonths.at(-1); if (!prev || m.start > prev.end) cleanMonths.push(m); });

    const accounts = new Set(['main', 'extra', 'external', ...DEFAULT_FUNDS.map((f) => f.id)]);
    const transactions = arr(src.transactions)
      .filter((t) => Utils.isPlainObject(t) && isoOk(t.date) && Number.isFinite(amt(t.amount)) && amt(t.amount) > 0)
      .map((t) => {
        if (t.type === 'expense') {
          return {
            id: str(t.id, 40) || Utils.uid('tx_'), type: 'expense', amount: amt(t.amount),
            categoryId: catIds.has(t.categoryId) ? t.categoryId : 'other',
            description: str(t.description, 120), date: t.date,
            account: t.account === 'extra' ? 'extra' : 'main',
            createdAt: t.createdAt || new Date().toISOString(),
          };
        }
        if (t.type === 'transfer' && accounts.has(t.from) && accounts.has(t.to) && t.from !== t.to) {
          return {
            id: str(t.id, 40) || Utils.uid('tr_'), type: 'transfer', kind: t.kind === 'withdraw' ? 'withdraw' : 'transfer',
            from: t.from, to: t.to, amount: amt(t.amount), note: str(t.note, 80), date: t.date,
            affectsBudget: !!t.affectsBudget, createdAt: t.createdAt || new Date().toISOString(),
          };
        }
        return null;
      })
      .filter(Boolean);

    const extraIncome = arr(src.extraIncome)
      .filter((e) => Utils.isPlainObject(e) && isoOk(e.date) && Number.isFinite(amt(e.amount)) && amt(e.amount) > 0)
      .map((e) => ({ id: str(e.id, 40) || Utils.uid('ex_'), type: EXTRA_TYPES.some((x) => x.id === e.type) ? e.type : 'other', amount: amt(e.amount), description: str(e.description, 80), date: e.date, createdAt: e.createdAt || new Date().toISOString() }));

    const fundsSrc = arr(src.funds);
    const funds = DEFAULT_FUNDS.map((def) => {
      const f = fundsSrc.find((x) => Utils.isPlainObject(x) && x.id === def.id) || {};
      return { ...def, name: str(f.name, 30) || def.name, description: str(f.description ?? def.description, 60), initialBalance: Utils.safeAmount(f.initialBalance), goal: Utils.safeAmount(f.goal) };
    });

    if (settings.setupDone && !cleanMonths.length && settings.salary <= 0) settings.setupDone = false;

    return { settings, months: cleanMonths, transactions, fixedExpenses, extraIncome, funds, categories };
  },
};

/* =========================================================
   13. Demo — بيانات تجريبية
   ========================================================= */
const Demo = {
  load() {
    Store.resetState();
    const theme = document.documentElement.getAttribute('data-theme');
    Object.assign(state.settings, {
      setupDone: true, salary: 15000, payday: 27, retainTarget: 3000, openingBalance: 0,
      theme: theme === 'dark' ? 'dark' : 'auto', createdAt: new Date().toISOString(),
    });
    state.fixedExpenses = [
      { id: 'fx_house', name: 'قسط البيت', amount: 3500, icon: '🏠', dueDay: 1 },
      { id: 'fx_car', name: 'قسط السيارة', amount: 1300, icon: '🚗', dueDay: 5 },
      { id: 'fx_elec', name: 'الكهرباء', amount: 450, icon: '💡', dueDay: 10 },
      { id: 'fx_net', name: 'الإنترنت', amount: 300, icon: '🌐', dueDay: 12 },
      { id: 'fx_mobile', name: 'الجوال', amount: 250, icon: '📱', dueDay: 15 },
      { id: 'fx_subs', name: 'الاشتراكات', amount: 200, icon: '📺', dueDay: 20 },
    ];
    Data.fund('emergency').initialBalance = 9500;
    Data.fund('emergency').goal = 30000;
    Data.fund('investment').initialBalance = 25000;
    Data.fund('investment').goal = 100000;

    Months.ensure();
    Months.prependPrevious();
    Months.prependPrevious();

    // مولد أرقام شبه عشوائي ثابت لنتائج متكررة
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const picks = [
      ['food', [25, 60, 95, 140], ['غداء', 'عشاء مع العائلة', 'بقالة', 'مطعم']],
      ['coffee', [14, 18, 22], ['قهوة الصباح', 'كوفي', 'لاتيه']],
      ['fuel', [60, 90, 120], ['تعبئة بنزين']],
      ['home', [45, 110, 180], ['أغراض المنزل', 'منظفات']],
      ['shopping', [120, 250], ['تسوق']],
      ['fun', [50, 90], ['سينما', 'ألعاب']],
      ['health', [35, 80], ['صيدلية']],
      ['transport', [25, 40], ['أوبر', 'مواقف']],
    ];
    const today = DateUtils.today();
    state.months.forEach((m, mi) => {
      const isCurrent = Data.isCurrent(m);
      m.fixedItems.forEach((i) => {
        if (!isCurrent || ['fx_house', 'fx_car', 'fx_elec'].includes(i.id)) { i.paid = true; i.paidDate = m.start; }
      });
      for (let d = m.start; d <= m.end && d <= today; d = DateUtils.addDays(d, 1)) {
        const count = d === today ? 2 : Math.floor(rand() * 3) + (mi === 1 ? 1 : 0);
        for (let k = 0; k < count; k += 1) {
          const [cat, amounts, descs] = picks[Math.floor(rand() * picks.length)];
          state.transactions.push({
            id: Utils.uid('tx_'), type: 'expense',
            amount: amounts[Math.floor(rand() * amounts.length)] + (rand() > 0.7 ? 0.5 : 0),
            categoryId: cat, description: descs[Math.floor(rand() * descs.length)],
            date: d, account: 'main', createdAt: `${d}T${String(9 + k * 4).padStart(2, '0')}:00:00.000Z`,
          });
        }
      }
    });

    const current = Data.currentMonth();
    state.extraIncome.push({ id: 'ex_demo1', type: 'bonus', amount: 3000, description: 'مكافأة أداء', date: current.start, createdAt: new Date().toISOString() });
    state.transactions.push({ id: 'tr_demo1', type: 'transfer', kind: 'transfer', from: 'main', to: 'emergency', amount: 500, note: 'ادخار شهري', date: current.start, affectsBudget: false, createdAt: new Date().toISOString() });
    Store.save();
  },
};

/* =========================================================
   14. Router + App
   ========================================================= */
const Router = {
  current() {
    const id = location.hash.replace('#', '').split('?')[0];
    return ROUTES.some((r) => r.id === id) ? id : 'dashboard';
  },
};

const App = {
  lastRoute: null,
  lastDay: null,

  init() {
    if (!Storage.isAvailable()) {
      document.getElementById('view').innerHTML = C.empty({
        icon: 'alert', title: 'التخزين المحلي غير متاح',
        text: 'يحتاج التطبيق إلى localStorage لحفظ بياناتك. تأكد أنك لا تستخدم وضع التصفح الخاص بإعدادات تمنع التخزين.',
      });
      return;
    }
    Store.load();
    UI.applyTheme();
    App.renderNav();
    App.bindEvents();
    App.lastDay = DateUtils.today();
    App.render();
    App.registerServiceWorker();
  },

  renderNav() {
    document.getElementById('sideNav').innerHTML = ROUTES.map((r) => `
      <a href="#${r.id}" class="side-link" data-route="${r.id}">${Utils.icon(r.icon)}<span>${r.title}</span></a>`).join('');
  },

  updateNav(route) {
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.route === route);
      if (el.dataset.route === route) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
    });
    const inMore = !['dashboard', 'expenses', 'funds'].includes(route);
    document.querySelector('[data-route-group="more"]')?.classList.toggle('is-active', inMore);
  },

  render() {
    const view = document.getElementById('view');
    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');
    UI.hideTip();

    try {
      if (!state.settings.setupDone) {
        document.body.classList.add('is-setup');
        title.textContent = 'إدارة المال';
        subtitle.textContent = 'الإعداد الأولي';
        view.innerHTML = Pages.setup();
        App.lastRoute = 'setup';
        return;
      }
      document.body.classList.remove('is-setup');
      Months.ensure();

      const route = Router.current();
      const meta = ROUTES.find((r) => r.id === route);
      const month = Data.currentMonth();
      title.textContent = meta.title;
      subtitle.textContent = month ? `الشهر المالي: ${DateUtils.range(month.start, month.end)}` : '';
      document.title = `${meta.title} — إدارة المال`;

      view.innerHTML = Pages[route]();
      if (route === 'expenses') Pages.renderExpenseList();

      App.updateNav(route);
      if (App.lastRoute !== route) {
        window.scrollTo({ top: 0 });
        view.style.animation = 'none';
        void view.offsetWidth; // إعادة تشغيل الحركة
        view.style.animation = '';
      }
      App.lastRoute = route;
    } catch (err) {
      console.error(err);
      view.innerHTML = C.empty({ icon: 'alert', title: 'حدث خطأ أثناء عرض الصفحة', text: 'جرّب تحديث الصفحة. إذا استمرت المشكلة صدّر نسخة احتياطية من الإعدادات.' });
    }
  },

  bindEvents() {
    // الأزرار
    document.addEventListener('click', (e) => {
      const navLink = e.target.closest('[data-close-on-nav]');
      if (navLink) { UI.closeModal(); return; }

      const el = e.target.closest('[data-action]');
      if (!el || el.disabled) return;
      const handler = Actions[el.dataset.action];
      if (!handler) return;
      e.preventDefault();
      Promise.resolve()
        .then(() => handler(el.dataset, el, e))
        .catch((err) => { console.error(err); UI.toast('حدث خطأ غير متوقع. حاول مرة أخرى.', 'error'); });
    });

    // النماذج
    const submitters = {
      expense: Forms.submitExpense,
      fixed: Forms.submitFixed,
      extra: Forms.submitExtra,
      transfer: Forms.submitTransfer,
      month: Forms.submitMonth,
      fund: Forms.submitFund,
      setup: Forms.submitSetup,
      settings: Forms.submitSettings,
      category: (form) => {
        const cat = Forms.submitCategory(form, { icon: form.querySelector('[name="icon"]').value, name: form.querySelector('[name="name"]').value });
        if (cat) App.render();
      },
    };
    document.addEventListener('submit', (e) => {
      const form = e.target.closest('form[data-form]');
      if (!form) return;
      e.preventDefault();
      const handler = submitters[form.dataset.form];
      if (!handler) return;
      const btn = form.querySelector('[type="submit"]');
      if (btn?.dataset.busy) return; // منع الإرسال المزدوج
      if (btn) btn.dataset.busy = '1';
      Promise.resolve()
        .then(() => handler(form))
        .catch((err) => { console.error(err); UI.toast('تعذّر حفظ البيانات. تحقق من المدخلات.', 'error'); })
        .finally(() => { if (btn) delete btn.dataset.busy; });
    });

    // الإدخال: تنسيق المبالغ + التصفية
    const debouncedList = Utils.debounce(() => Pages.renderExpenseList(), 150);
    document.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-amount]')) Forms.formatAmountInput(t);
      if (t.matches('[data-integer]')) Forms.formatIntegerInput(t);
      if (t.name) {
        const form = t.closest('form');
        if (form) Forms.setError(form, t.name, '');
      }
      if (t.matches('[data-filter="q"]')) {
        state.ui.filters.q = t.value;
        state.ui.listLimit = 60;
        debouncedList();
      }
    });

    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.matches('[data-filter]') && t.dataset.filter !== 'q') {
        state.ui.filters[t.dataset.filter] = t.value;
        state.ui.listLimit = 60;
        Pages.renderExpenseList();
      }
      if (t.matches('[data-analytics-scope]')) {
        state.ui.analyticsScope = t.value;
        App.render();
      }
      if (t.name === 'categoryId') {
        const form = t.closest('form');
        if (form) Forms.setError(form, 'categoryId', '');
      }
    });

    // مفتاح Escape لإغلاق النوافذ
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && UI.topModal()) UI.closeModal();
      // اختصار: N لإضافة مصروف (على سطح المكتب)
      if (e.key.toLowerCase() === 'n' && !UI.topModal() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !e.ctrlKey && !e.metaKey) {
        Actions['add-expense']();
      }
    });

    // Tooltip للرسوم
    document.addEventListener('pointerover', (e) => {
      const col = e.target.closest('[data-tip]');
      if (!col) return;
      const r = col.getBoundingClientRect();
      UI.showTip(col.dataset.tip, r.left + r.width / 2, r.top);
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest('[data-tip]')) UI.hideTip();
    });

    window.addEventListener('hashchange', () => {
      UI.closeAllModals();
      App.render();
    });

    // تغيير الوضع التلقائي
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
      if (state.settings.theme === 'auto') UI.applyTheme();
    });

    // ظل الشريط العلوي عند التمرير
    const topbar = document.querySelector('.topbar');
    window.addEventListener('scroll', () => topbar.classList.toggle('is-scrolled', window.scrollY > 4), { passive: true });

    // تحديث تلقائي عند بداية يوم جديد
    const checkDay = () => {
      const today = DateUtils.today();
      if (today !== App.lastDay) {
        App.lastDay = today;
        Calc.invalidate();
        if (!UI.topModal()) App.render();
      }
    };
    setInterval(checkDay, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

    // مزامنة بين التبويبات
    window.addEventListener('storage', (e) => {
      if (Object.values(STORAGE_KEYS).includes(e.key)) {
        Store.load();
        Calc.invalidate();
        UI.applyTheme();
        if (!UI.topModal()) App.render();
      }
    });
  },

  /** تفعيل العمل دون إنترنت (يعمل فقط على http/https مثل GitHub Pages) */
  registerServiceWorker() {
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed', err));
    }
  },
};

document.addEventListener('DOMContentLoaded', App.init);
