'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const {
  DOCTOR_WEB_DIR,
  makeMemoryStorage,
  transpileAndLoad,
  parseTsAst,
  findNodes,
  renderWithHookCounter,
} = require('./harness.cjs');

const SRC = path.join(DOCTOR_WEB_DIR, 'src');
const p = (...parts) => path.join(SRC, ...parts);

const SAMPLE_APT = {
  id: 'apt-1',
  patient_id: 'pat-1',
  patient_name: 'Cụ Nguyễn Văn An',
  visit_type: 'HOME_VISIT',
  scheduled_at: '2026-11-22T02:00:00Z',
  duration_minutes: 30,
  location: 'Tại nhà',
  clinical_notes: 'Khám định kỳ',
  status: 'UPCOMING',
  enable_speaker_reminder: true,
};

// ============================================================================
// Feature #7: CancelAppointmentModal & handleConfirmCancel
// ============================================================================

test('T1-F07-01 CancelAppointmentModal hook count & order identical across closed and open renders', () => {
  const file = p('components/clinical/CancelAppointmentModal.tsx');
  const closed = renderWithHookCounter(file, 'CancelAppointmentModal', {
    isOpen: false,
    appointment: null,
    onClose: () => {},
    onConfirm: async () => {},
  });
  const open = renderWithHookCounter(file, 'CancelAppointmentModal', {
    isOpen: true,
    appointment: SAMPLE_APT,
    onClose: () => {},
    onConfirm: async () => {},
  });

  assert.equal(closed.html, '');
  assert.ok(open.html.includes('Xác nhận hủy cuộc hẹn khám'));
  assert.deepEqual(
    closed.hookOrder,
    open.hookOrder,
    `Hook order mismatch across closed (${closed.hookOrder}) vs open (${open.hookOrder})`
  );
  assert.equal(closed.totalHooks, open.totalHooks);
});

test('T1-F07-02 CancelAppointmentModal quick reason chip populates and submits trimmed text', () => {
  const { code } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  assert.match(code, /Bệnh nhân \/ Gia đình xin hoãn/);
  assert.match(code, /handleSelectChip/);
  assert.match(code, /await onConfirm\(appointment\.id,\s*(trimmed|finalReason)/);
});

test('T1-F07-03 CancelAppointmentModal validates custom reason >= 3 chars before submit', () => {
  const { code } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  assert.match(code, /\.trim\(\)/);
  assert.match(code, /length\s*<\s*3|length\s*>=\s*3/);
});

test('T1-F07-04 AppointmentsPage handleConfirmCancel calls cancelAppointment and refreshes store', () => {
  const { code } = parseTsAst(p('pages/AppointmentsPage.tsx'));
  assert.match(code, /handleConfirmCancel[\s\S]*?doctorApi\.cancelAppointment\(aptId,\s*reason\)/);
  assert.match(code, /handleConfirmCancel[\s\S]*?fetchAllData\(true\)/);
});

test('T1-F07-05 CancelAppointmentModal resets reason & error state when reopened for new appointment', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  const effects = findNodes(
    sf,
    (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useEffect'
  );
  const resetEffect = effects.find((e) => e.getText(sf).includes('setReason(QUICK_REASONS[0])'));
  assert.ok(resetEffect, 'Expected useEffect resetting reason to QUICK_REASONS[0]');
  assert.match(resetEffect.getText(sf), /Error|error/i, 'Expected reset useEffect to also clear error state');
});

test('T2-F07-01 CancelAppointmentModal blocks empty/whitespace/<3 char reason without silent fallback', () => {
  const { code } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  assert.equal(
    /reason\.trim\(\)\s*\|\|\s*['"]Thay đổi lịch khám từ Bác sĩ['"]/.test(code),
    false,
    'Must NOT silently replace empty reason with fallback string'
  );
  assert.match(code, /(trimmed|finalReason)\.length\s*<\s*3|trim\(\)\.length\s*<\s*3/);
});

test('T2-F07-02 CancelAppointmentModal keeps modal open and shows inline error when onConfirm rejects', () => {
  const { ts, sf, code } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  const handleSubmit = findNodes(
    sf,
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'handleSubmit'
  )[0];
  assert.ok(handleSubmit, 'handleSubmit must exist');
  const txt = handleSubmit.getText(sf);
  const catchMatch = txt.match(/catch\s*(\([^)]*\))?\s*\{([\s\S]*?)\}/);
  assert.ok(catchMatch && catchMatch[2].trim().length > 0 && !/^\s*\/\/[^\n]*\s*$/.test(catchMatch[2]), 'catch block must set inline error instead of swallowing error');
  assert.match(code, /setError|errorMsg|submitError/);
});

test('T2-F07-03 AppointmentsPage handleConfirmCancel rethrows API errors so modal stays open', () => {
  const { ts, sf } = parseTsAst(p('pages/AppointmentsPage.tsx'));
  const fn = findNodes(
    sf,
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'handleConfirmCancel'
  )[0];
  assert.ok(fn, 'handleConfirmCancel must exist');
  const txt = fn.getText(sf);
  assert.match(txt, /catch[\s\S]*throw\b/, 'handleConfirmCancel catch block must rethrow error');
});

test('T2-F07-04 CancelAppointmentModal prevents double-submit while isSubmitting is true', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/CancelAppointmentModal.tsx'));
  const handleSubmit = findNodes(
    sf,
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'handleSubmit'
  )[0];
  assert.ok(handleSubmit);
  const txt = handleSubmit.getText(sf);
  assert.match(txt, /if\s*\(\s*isSubmitting\s*\)\s*return/);
});

test('T2-F07-05 CancelAppointmentModal renders null safely when isOpen=true and appointment=null', () => {
  const file = p('components/clinical/CancelAppointmentModal.tsx');
  const res = renderWithHookCounter(file, 'CancelAppointmentModal', {
    isOpen: true,
    appointment: null,
    onClose: () => {},
    onConfirm: async () => {},
  });
  assert.equal(res.html, '');
  const closed = renderWithHookCounter(file, 'CancelAppointmentModal', {
    isOpen: false,
    appointment: null,
    onClose: () => {},
    onConfirm: async () => {},
  });
  assert.deepEqual(res.hookOrder, closed.hookOrder);
});

// ============================================================================
// Feature #8: Doctor Web Local-Date Unification (UTC+7 Safe)
// ============================================================================

test('T1-F08-01 dateFilter getTodayYMD returns UTC+7 local calendar date', () => {
  const mod = transpileAndLoad(p('utils/dateFilter.ts'), {}, { fixedNow: '2026-11-21T20:00:00Z' });
  assert.equal(mod.getTodayYMD(), '2026-11-22');
});

test('T1-F08-02 dateFilter formatYMD converts UTC ISO timestamp to UTC+7 local date', () => {
  const mod = transpileAndLoad(p('utils/dateFilter.ts'));
  assert.equal(mod.formatYMD(new Date('2026-11-21T18:30:00Z')), '2026-11-22');
});

test('T1-F08-03 AppointmentWeekStrip toLocalIsoDate uses local UTC+7 calendar date', () => {
  const mod = transpileAndLoad(p('components/clinical/AppointmentWeekStrip.tsx'), {
    react: require(path.join(DOCTOR_WEB_DIR, 'node_modules/react')),
    'lucide-react': {},
  });
  assert.equal(mod.toLocalIsoDate(new Date('2026-11-21T23:30:00Z')), '2026-11-22');
});

test('T1-F08-04 DashboardPage uses local date helpers instead of UTC toISOString or startsWith', () => {
  const { code } = parseTsAst(p('pages/DashboardPage.tsx'));
  assert.equal(/\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/.test(code), false, 'DashboardPage must not use .toISOString().slice(0, 10)');
  assert.equal(/\.scheduled_at\?\.startsWith\(/.test(code) || /\.scheduled_at\.startsWith\(/.test(code), false, 'DashboardPage must not use scheduled_at.startsWith(dateStr)');
  assert.equal(/\.scheduled_at\?\.slice\(\s*0\s*,\s*10\s*\)/.test(code) || /\.scheduled_at\.slice\(\s*0\s*,\s*10\s*\)/.test(code), false, 'DashboardPage must not slice UTC scheduled_at prefix');
});

test('T1-F08-05 navbarNotifications tags early-morning UTC+7 appointment as Khám hôm nay', async () => {
  const fixedNow = '2026-11-21T18:00:00Z'; // 2026-11-22 01:00+07:00 (before 02:00+07:00 appointment)
  const mod = transpileAndLoad(
    p('components/layout/navbarNotifications.ts'),
    {
      '../../services/api': {
        incidentsApi: { list: async () => [] },
        doctorApi: {
          getPatients: async () => [],
          getAppointments: async () => [
            {
              id: 'apt-vn-midnight',
              patient_id: 'pat-1',
              patient_name: 'Cụ An',
              visit_type: 'HOME_VISIT',
              scheduled_at: '2026-11-21T19:00:00Z', // 2026-11-22 02:00+07:00
              location: 'Tại nhà',
              status: 'UPCOMING',
            },
          ],
        },
        householdApi: { getInvites: async () => [] },
        systemNotificationsApi: { getActiveBroadcasts: async () => [] },
      },
      '../../utils/notificationSync': {
        cleanNotificationText: (s) => s,
        getStoredReadIds: () => new Set(),
      },
    },
    { fixedNow }
  );
  const items = await mod.fetchDoctorNavbarNotifications('doc-1');
  const aptItem = items.find((i) => i.id === 'apt_apt-vn-midnight');
  assert.ok(aptItem, 'Expected appointment notification item');
  assert.equal(aptItem.badgeLabel, 'Khám hôm nay');
});

test('T2-F08-01 dateFilter getTodayYMD handles 00:05+07:00 (17:05Z prev day) without drifting', () => {
  const mod = transpileAndLoad(p('utils/dateFilter.ts'), {}, { fixedNow: '2026-11-21T17:05:00Z' });
  assert.equal(mod.getTodayYMD(), '2026-11-22');
});

test('T2-F08-02 dateFilter formatYMD keeps 23:59:59+07:00 (16:59:59Z) on same local day', () => {
  const mod = transpileAndLoad(p('utils/dateFilter.ts'));
  assert.equal(mod.formatYMD(new Date('2026-11-21T16:59:59Z')), '2026-11-21');
});

test('T2-F08-03 AppointmentWeekStrip and navbarNotifications have zero toISOString().slice(0,10)', () => {
  for (const rel of ['components/clinical/AppointmentWeekStrip.tsx', 'components/layout/navbarNotifications.ts', 'pages/DashboardPage.tsx']) {
    const { code } = parseTsAst(p(rel));
    assert.equal(/\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/.test(code), false, `${rel} must not use .toISOString().slice(0, 10)`);
  }
});

test('T2-F08-04 dateFilter handles leap day 2028-02-29 and year rollover in UTC+7', () => {
  const mod = transpileAndLoad(p('utils/dateFilter.ts'));
  assert.equal(mod.formatYMD(mod.parseYMD('2028-02-29')), '2028-02-29');
  assert.equal(mod.formatYMD(new Date('2026-12-31T18:00:00Z')), '2027-01-01');
});

test('T2-F08-05 AppointmentsPage and DashboardPage guard invalid scheduled_at date strings safely', () => {
  for (const rel of ['pages/AppointmentsPage.tsx', 'components/clinical/AppointmentWeekStrip.tsx']) {
    const { code } = parseTsAst(p(rel));
    assert.match(code, /isNaN\(|try\s*\{/);
  }
});

// ============================================================================
// Feature #9: NewAppointmentModal Multi-Hour Slot & Types
// ============================================================================

test('T1-F09-01 NewAppointmentModal defaults to 09:00 on selected empty day', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const { code: helperCode } = parseTsAst(p('utils/appointmentHelpers.ts'));
  assert.match(`${code}\n${helperCode}`, /9,\s*0|09:00|setHours\(9/);
});

test('T1-F09-02 NewAppointmentModal computes next non-overlapping free slot from existing appointments', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  assert.match(code, /duration_minutes|appointments/, 'Must inspect existing appointments/durations to suggest non-overlapping slot');
  assert.equal(/d\.setHours\(9,\s*0,\s*0,\s*0\);\s*\}\s*const pad/.test(code), false, 'Must not unconditionally hardcode 09:00 ignoring existing appointments');
});

test('T1-F09-03 NewAppointmentModal sends selected duration_minutes on createAppointment', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  assert.match(code, /durationMinutes|setDurationMinutes/);
  assert.equal(/duration_minutes:\s*30\b/.test(code), false, 'createAppointment must not hardcode duration_minutes: 30');
  assert.match(code, /createAppointment\(\{[\s\S]*?duration_minutes:/);
});

test('T1-F09-04 NewAppointmentModal sends duration_minutes on updateAppointment', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const updateCalls = findNodes(
    sf,
    (n) => ts.isCallExpression(n) && n.expression.getText(sf).endsWith('updateAppointment')
  );
  assert.ok(updateCalls.length > 0, 'updateAppointment call must exist');
  assert.match(updateCalls[0].getText(sf), /duration_minutes:/);
});

test('T1-F09-05 NewAppointmentModal supports TELEHEALTH visit type', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  assert.match(code, /TELEHEALTH/);
});

test('T2-F09-01 NewAppointmentModal free slot finder advances past consecutive overlapping blocks', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const { code: helperCode } = parseTsAst(p('utils/appointmentHelpers.ts'));
  assert.match(`${code}\n${helperCode}`, /while\s*\(|some\(/, 'Expected interval overlap loop/check when computing free slot');
});

test('T2-F09-02 NewAppointmentModal free slot finder ignores CANCELLED appointments', () => {
  const { code } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const { code: helperCode } = parseTsAst(p('utils/appointmentHelpers.ts'));
  assert.match(`${code}\n${helperCode}`, /CANCELLED|UPCOMING|isUpcomingAppointmentStatus/);
});

test('T2-F09-03 NewAppointmentModal validates scheduledAt before calling toISOString', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const handleSubmit = findNodes(
    sf,
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'handleSubmit'
  )[0];
  assert.ok(handleSubmit);
  const txt = handleSubmit.getText(sf);
  assert.match(txt, /!scheduledAt|isNaN\([^)]*getTime\(\)/, 'Must validate scheduledAt before calling .toISOString()');
});

test('T2-F09-04 NewAppointmentModal syncs patientId via useEffect when patients or initialPatientId changes', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const effects = findNodes(
    sf,
    (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useEffect'
  );
  assert.ok(effects.some((e) => e.getText(sf).includes('setPatientId')), 'Expected useEffect syncing patientId');
});

test('T2-F09-05 NewAppointmentModal sorts store.appointments chronologically after updateAppointment', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/NewAppointmentModal.tsx'));
  const handleSubmit = findNodes(
    sf,
    (n) => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'handleSubmit'
  )[0];
  assert.ok(handleSubmit);
  const txt = handleSubmit.getText(sf);
  const updateBlock = txt.slice(txt.indexOf('updateAppointment'), txt.indexOf('} else {'));
  assert.match(updateBlock, /\.sort\(/, 'Reschedule branch must sort store.appointments chronologically');
});

// ============================================================================
// Feature #10: Doctor Web Views, Sorting, Dots & Deep-Links
// ============================================================================

test('T1-F10-01 AppointmentWeekStrip tracks UPCOMING and COMPLETED flags per day', () => {
  const { code } = parseTsAst(p('components/clinical/AppointmentWeekStrip.tsx'));
  assert.match(code, /hasUpcoming/);
  assert.match(code, /hasCompleted/);
});

test('T1-F10-02 AppointmentsPage reads ?date= query param and syncs AppointmentWeekStrip', () => {
  const { code: pageCode } = parseTsAst(p('pages/AppointmentsPage.tsx'));
  assert.match(pageCode, /useSearchParams/);
  assert.match(pageCode, /get\(['"]date['"]\)/);
});

test('T1-F10-03 PatientsPage reads ?id= deep-link and selects patient drawer', () => {
  const { code } = parseTsAst(p('pages/PatientsPage.tsx'));
  assert.match(code, /searchParams\.get\(['"]id['"]\)/);
});

test('T1-F10-04 DayAppointmentsModal, AppointmentsPage, and PatientDrawerTabs sort appointments chronologically', () => {
  for (const rel of ['components/dashboard/DayAppointmentsModal.tsx', 'pages/AppointmentsPage.tsx', 'components/clinical/PatientDrawerTabs.tsx']) {
    const { code } = parseTsAst(p(rel));
    assert.match(code, /\.sort\(/, `${rel} must sort appointments chronologically`);
  }
});

test('T1-F10-05 AppointmentsPage supports Vietnamese diacritic-insensitive search', () => {
  const { code } = parseTsAst(p('pages/AppointmentsPage.tsx'));
  assert.match(code, /normalize\(['"]NFD['"]\)|removeVietnameseTones/);
});

test('T2-F10-01 AppointmentWeekStrip excludes CANCELLED appointments from day flags/dots', () => {
  const { ts, sf } = parseTsAst(p('components/clinical/AppointmentWeekStrip.tsx'));
  const fn = findNodes(
    sf,
    (n) => ts.isFunctionDeclaration(n) && n.name && n.name.text === 'getDayAppointmentFlags'
  )[0];
  assert.ok(fn);
  const txt = fn.getText(sf);
  assert.match(txt, /CANCELLED/, 'getDayAppointmentFlags must exclude CANCELLED appointments');
});

test('T2-F10-02 AppointmentWeekStrip does not force today active when selectedDateStr === null', () => {
  const { code } = parseTsAst(p('components/clinical/AppointmentWeekStrip.tsx'));
  assert.equal(
    /selectedDateStr\s*===\s*d\.isoDate\s*\|\|\s*\(\s*selectedDateStr\s*===\s*null\s*&&\s*d\.isToday\s*\)/.test(code),
    false,
    'isActive must not highlight today as selected filter when selectedDateStr === null'
  );
});

test('T2-F10-03 DashboardPage nextAppointment excludes past-due UPCOMING appointments', () => {
  const { code } = parseTsAst(p('pages/DashboardPage.tsx'));
  assert.match(code, /nextAppointment[\s\S]{0,400}Date\.now\(\)/);
});

test('T2-F10-04 AppointmentsPage completionRate does not return fake 85 and hubEnabledCount excludes CANCELLED', () => {
  const { code } = parseTsAst(p('pages/AppointmentsPage.tsx'));
  assert.equal(/\?\s*Math\.round\([\s\S]*?\)\s*:\s*85\b/.test(code), false, 'completionRate must not default to 85');
  assert.match(code, /hubEnabledCount[\s\S]{0,120}CANCELLED/);
});

test('T2-F10-05 DayAppointmentsModal & AppointmentCard render accurate visit_type labels and cancellation_reason', () => {
  const dayRes = renderWithHookCounter(p('components/dashboard/DayAppointmentsModal.tsx'), 'DayAppointmentsModal', {
    isOpen: true,
    dateStr: '2026-11-22',
    appointments: [
      { ...SAMPLE_APT, id: 'a-clinic', visit_type: 'CLINIC', exam_type: 'Khám định kỳ' },
    ],
    onClose: () => {},
    onOpenCreate: () => {},
    onNavigateAppointments: () => {},
  });
  assert.equal(dayRes.html.includes('Khám tại nhà'), false, 'CLINIC appointment with exam_type must NOT render Khám tại nhà');

  const cardCancelled = renderWithHookCounter(p('components/clinical/AppointmentCard.tsx'), 'AppointmentCard', {
    apt: { ...SAMPLE_APT, status: 'CANCELLED', cancellation_reason: 'Bệnh nhân đi vắng' },
    onBroadcastReminder: () => {},
    onReschedule: () => {},
    onCancel: () => {},
    onComplete: () => {},
  });
  assert.ok(cardCancelled.html.includes('Bệnh nhân đi vắng'), 'Cancelled AppointmentCard must render cancellation_reason');

  const cardTelehealth = renderWithHookCounter(p('components/clinical/AppointmentCard.tsx'), 'AppointmentCard', {
    apt: { ...SAMPLE_APT, visit_type: 'TELEHEALTH' },
    onBroadcastReminder: () => {},
    onReschedule: () => {},
    onCancel: () => {},
    onComplete: () => {},
  });
  assert.ok(cardTelehealth.html.includes('Tư vấn từ xa') && !cardTelehealth.html.includes('Khám tại nhà / Tư vấn từ xa'), 'TELEHEALTH AppointmentCard must show dedicated telehealth label');
});

// ============================================================================
// Feature #11: Doctor Web Store Sync, Cache Invalidation & WS Events
// ============================================================================

test('T1-F11-01 useDoctorDataStore fetchAllData(true) refreshes store appointments', async () => {
  const storage = makeMemoryStorage();
  const { useDoctorDataStore } = transpileAndLoad(
    p('store/useDoctorDataStore.ts'),
    {
      zustand: require(path.join(DOCTOR_WEB_DIR, 'node_modules/zustand')),
      '../services/api': {
        doctorApi: {
          getPatients: async () => [],
          getAppointments: async () => [{ ...SAMPLE_APT, id: 'fresh-apt' }],
        },
        householdApi: { getInvites: async () => [] },
        incidentsApi: { list: async () => [] },
      },
    },
    { localStorage: storage }
  );
  useDoctorDataStore.getState().setAppointments([{ ...SAMPLE_APT, id: 'stale-apt' }]);
  await useDoctorDataStore.getState().fetchAllData(true);
  assert.deepEqual(
    useDoctorDataStore.getState().appointments.map((a) => a.id),
    ['fresh-apt']
  );
});

test('T1-F11-02 clearCache wipes store & localStorage and PatientsPage clears drawer cache', () => {
  const storage = makeMemoryStorage();
  const { useDoctorDataStore } = transpileAndLoad(
    p('store/useDoctorDataStore.ts'),
    {
      zustand: require(path.join(DOCTOR_WEB_DIR, 'node_modules/zustand')),
      '../services/api': { doctorApi: {}, householdApi: {}, incidentsApi: {} },
    },
    { localStorage: storage }
  );
  useDoctorDataStore.getState().setAppointments([SAMPLE_APT]);
  assert.ok(storage.getItem('seca_cache_appointments'));
  useDoctorDataStore.getState().clearCache();
  assert.equal(useDoctorDataStore.getState().appointments.length, 0);
  assert.equal(storage.getItem('seca_cache_appointments'), null);

  const { code } = parseTsAst(p('pages/PatientsPage.tsx'));
  assert.match(code, /patientDrawerCache\.delete|patientDrawerCache\.clear/);
});

test('T1-F11-03 DoctorLayout handles FALL_DETECTED WS event with emergency alarm sound', () => {
  const { code } = parseTsAst(p('components/layout/DoctorLayout.tsx'));
  assert.match(code, /FALL_DETECTED/);
  assert.match(code, /playEmergencyAlarmSound\(4\)/);
});

test('T1-F11-04 DoctorLayout handles APPOINTMENT_* WS events without triggering emergency siren', () => {
  const { code } = parseTsAst(p('components/layout/DoctorLayout.tsx'));
  assert.match(code, /APPOINTMENT_SCHEDULED|APPOINTMENT_/);
  assert.match(code, /fetchAllData\(true\)/);
});

test('T1-F11-05 doctorApi.completeAppointment forwards clinical_notes in POST body', async () => {
  let postedUrl = null;
  let postedBody = null;
  const mockApi = {
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
    post: async (url, body) => {
      postedUrl = url;
      postedBody = body;
      return { data: { id: 'apt-1', status: 'COMPLETED' } };
    },
  };
  const { doctorApi } = transpileAndLoad(p('services/api.ts'), {
    axios: { create: () => mockApi },
  });
  await doctorApi.completeAppointment('apt-1', 'Huyết áp ổn định');
  assert.equal(postedUrl, '/doctor/appointments/apt-1/complete');
  assert.equal(postedBody?.clinical_notes, 'Huyết áp ổn định');
  assert.deepEqual(Object.keys(postedBody || {}), ['clinical_notes']);
});

test('T2-F11-01 useDoctorDataStore fetchAllData(true) while fetchAllData(false) is in-flight does not return stale response', async () => {
  let callCount = 0;
  let resolveFirst;
  const firstPromise = new Promise((res) => {
    resolveFirst = res;
  });
  const storage = makeMemoryStorage();
  const { useDoctorDataStore } = transpileAndLoad(
    p('store/useDoctorDataStore.ts'),
    {
      zustand: require(path.join(DOCTOR_WEB_DIR, 'node_modules/zustand')),
      '../services/api': {
        doctorApi: {
          getPatients: async () => [],
          getAppointments: async () => {
            callCount += 1;
            if (callCount === 1) return firstPromise;
            return [{ ...SAMPLE_APT, id: 'A' }, { ...SAMPLE_APT, id: 'B' }];
          },
        },
        householdApi: { getInvites: async () => [] },
        incidentsApi: { list: async () => [] },
      },
    },
    { localStorage: storage }
  );

  const p1 = useDoctorDataStore.getState().fetchAllData(false);
  const p2 = useDoctorDataStore.getState().fetchAllData(true);
  resolveFirst([{ ...SAMPLE_APT, id: 'A' }]);
  await Promise.all([p1, p2]);
  assert.deepEqual(
    useDoctorDataStore.getState().appointments.map((a) => a.id),
    ['A', 'B']
  );
});

test('T2-F11-02 DashboardPage WS/polling useEffect deps do not include patients', () => {
  const { ts, sf } = parseTsAst(p('pages/DashboardPage.tsx'));
  const effects = findNodes(
    sf,
    (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'useEffect'
  );
  const wsEffect = effects.find((e) => e.getText(sf).includes('doctorWebSocket.subscribe'));
  assert.ok(wsEffect, 'Expected doctorWebSocket.subscribe useEffect in DashboardPage');
  const depsArg = wsEffect.arguments[1];
  assert.ok(depsArg, 'WS useEffect must have dependency array');
  assert.equal(/\bpatients\b/.test(depsArg.getText(sf)), false, 'WS/interval useEffect deps must NOT include patients');
});

test('T2-F11-03 PatientsPage invalidates patientDrawerCache on appointment mutation', () => {
  const { code } = parseTsAst(p('pages/PatientsPage.tsx'));
  assert.match(code, /patientDrawerCache\.delete\(selectedPatientId\)|patientDrawerCache\.delete\(.*?\)/);
});

test('T2-F11-04 DoctorLayout suppresses alarm on all appointment events and navbarNotifications has no patList[0] fallback', () => {
  const { code: layoutCode } = parseTsAst(p('components/layout/DoctorLayout.tsx'));
  for (const evt of ['APPOINTMENT_SCHEDULED', 'APPOINTMENT_REQUESTED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_CANCELLED', 'APPOINTMENT_DELETED']) {
    assert.ok(layoutCode.includes(evt) || /startsWith\(['"]APPOINTMENT_/.test(layoutCode), `DoctorLayout must handle ${evt} without alarm`);
  }
  const { code: navCode } = parseTsAst(p('components/layout/navbarNotifications.ts'));
  assert.equal(/patIdx\s*>=\s*0\s*\?\s*patList\[patIdx\]\s*:\s*patList\[0\]/.test(navCode), false, 'navbarNotifications must NOT fall back to patList[0] on unmatched patient');
});

test('T2-F11-05 Doctor Web AppointmentItem type includes TELEHEALTH and duration_minutes', () => {
  const { code } = parseTsAst(p('types/index.ts'));
  assert.match(code, /AppointmentItem[\s\S]*?TELEHEALTH/);
  assert.match(code, /AppointmentItem[\s\S]*?duration_minutes/);
});

test('Doctor Web requires is_online for Ổn định status/filter and shows Ngoại tuyến when offline', () => {
  const pageCode = parseTsAst(p('pages/PatientsPage.tsx')).code;
  const cardCode = parseTsAst(p('components/clinical/PatientCard.tsx')).code;
  const headerCode = parseTsAst(p('components/clinical/PatientDrawerHeader.tsx')).code;
  const tableCode = parseTsAst(p('components/dashboard/DoctorPatientTable.tsx')).code;
  assert.match(pageCode, /normal\s*=[\s\S]*?p\.is_online/);
  assert.match(pageCode, /statusFilter === 'NORMAL'[\s\S]*?p\.is_online/);
  assert.match(cardCode, /patient\.is_online\s*\?\s*'Ổn định'\s*:\s*'Ngoại tuyến'/);
  assert.match(cardCode, /patient\.is_online && patient\.heart_rate != null/);
  assert.match(headerCode, /offline:\s*\{[\s\S]*?label:\s*'Ngoại tuyến'/);
  assert.match(tableCode, /patient\.is_online[\s\S]*?Ổn định[\s\S]*?Ngoại tuyến/);
  assert.match(tableCode, /patient\.is_online && patient\.heart_rate != null/);
});
