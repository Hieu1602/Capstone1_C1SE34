'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { MOBILE_DIR, transpileAndLoad, parseTsAst, findNodes } = require('./harness.cjs');

const SRC = path.join(MOBILE_DIR, 'src');
const p = (...parts) => path.join(SRC, ...parts);

function createWsHarness(initialIncidents = [], authOverrides = {}) {
  const incidents = [...initialIncidents];
  const calls = {
    acknowledged: [],
    added: [],
    siren: [],
    escalations: [],
    clearedEscalations: [],
    notifications: [],
    stoppedAlarm: 0,
  };

  const vitalState = {
    incidents,
    house: { id: 'house-1' },
    iotDevices: [],
    patientsList: [],
    addIncident: (inc) => {
      incidents.unshift(inc);
      calls.added.push(inc);
    },
    acknowledgeIncident: (id, note, by) => {
      const target = incidents.find((i) => i.id === id);
      if (target) target.is_acknowledged = true;
      calls.acknowledged.push({ id, note, by });
    },
    setVitals: () => {},
    setSirenActive: (val) => calls.siren.push(val),
    fetchHouseFromBackend: () => {},
    syncAllWithBackend: async () => {},
  };

  const authState = {
    userId: 'fam-user-1',
    user_id: 'fam-user-1',
    viewRole: 'FAMILY',
    role: 'owner',
    fetchMyPermissions: async () => {},
    ...authOverrides,
  };

  const escalationState = {
    triggerEscalation: (payload) => calls.escalations.push(payload),
    clearEscalation: (id) => calls.clearedEscalations.push(id),
    markEscalated: () => {},
  };

  const mod = transpileAndLoad(p('services/websocket.ts'), {
    'react-native': { Platform: { OS: 'ios' } },
    'expo-constants': { default: { expoConfig: {} }, expoConfig: {} },
    '../store/useVitalStore': {
      useVitalStore: { getState: () => vitalState },
    },
    '../store/useAuthStore': {
      useAuthStore: { getState: () => authState },
    },
    '../store/useAlertStore': {
      useAlertStore: { getState: () => ({}) },
    },
    '../store/useEscalationStore': {
      useEscalationStore: { getState: () => escalationState },
    },
    './notificationService': {
      notificationService: {
        triggerEmergencyNotification: (n) => calls.notifications.push(n),
        stopEmergencyAlarm: () => {
          calls.stoppedAlarm += 1;
        },
      },
    },
  });

  return { alertsWS: mod.alertsWS, incidents, calls };
}

// ============================================================================
// Feature #12: Mobile Time-Picker, UTC/Local Date & Scheduling
// ============================================================================

test('T1-F12-01 AppointmentModals parses standard HH:mm slots without || 8 or || 30 falsy coercion', () => {
  const { ts, sf, code } = parseTsAst(p('features/doctor/components/AppointmentModals.tsx'));
  const badFallbacks = findNodes(
    sf,
    (n) =>
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
      ((n.left.getText(sf) === 'hours' && n.right.getText(sf) === '8') ||
        (n.left.getText(sf) === 'minutes' && n.right.getText(sf) === '30'))
  );
  assert.equal(badFallbacks.length, 0, 'AppointmentModals must NOT coerce 0 hours/minutes via || 8 or || 30');
  assert.match(code, /syncScheduledAt/);
});

test('T1-F12-02 DoctorPatientsScreen submits timezone-aware scheduled_at (not UTC-stripped slice(0,16))', () => {
  const { code } = parseTsAst(p('features/doctor/screens/DoctorPatientsScreen.tsx'));
  assert.equal(/setScheduledAt\(d\.toISOString\(\)\.slice\(\s*0\s*,\s*16\s*\)\)/.test(code), false, 'DoctorPatientsScreen must NOT strip timezone via toISOString().slice(0,16)');
});

test('T1-F12-03 WeekCalendarStrip uses local calendar date instead of UTC startsWith matching', () => {
  const { code } = parseTsAst(p('features/doctor/components/AppointmentComponents.tsx'));
  assert.equal(/a\.scheduled_at\.startsWith\(dayStr\)/.test(code), false, 'WeekCalendarStrip must NOT compare UTC ISO prefix with local dayStr via startsWith');
});

test('T1-F12-04 DoctorHomeScreen todayAppointments uses local UTC+7 calendar date', () => {
  const { code } = parseTsAst(p('features/doctor/screens/DoctorHomeScreen.tsx'));
  assert.equal(/new Date\(\)\.toISOString\(\)\.slice\(\s*0\s*,\s*10\s*\)/.test(code), false, 'DoctorHomeScreen must NOT use UTC toISOString().slice(0, 10)');
  assert.equal(/apt\.scheduled_at\?\.slice\(\s*0\s*,\s*10\s*\)\s*===\s*todayStr/.test(code), false, 'DoctorHomeScreen must NOT compare UTC scheduled_at slice(0,10)');
});

test('T1-F12-05 notificationHelpers formatDate labels early-morning UTC+7 appointment as Hôm nay, 01:30', () => {
  const mod = transpileAndLoad(
    p('features/doctor/components/notifications/notificationHelpers.ts'),
    { '@expo/vector-icons': { Ionicons: { glyphMap: {} } } },
    { fixedNow: '2026-11-22T01:00:00Z' } // 2026-11-22 08:00+07:00
  );
  const label = mod.formatDate('2026-11-21T18:30:00Z'); // 2026-11-22 01:30+07:00
  assert.ok(label.startsWith('Hôm nay,'), `Expected "Hôm nay, 01:30", got "${label}"`);
  assert.ok(label.includes('01:30'), `Expected 01:30 in "${label}"`);
});

test('T2-F12-01 AppointmentModals preserves 00:00 and 08:00 without falsy fallback coercion', () => {
  const { ts, sf, code } = parseTsAst(p('features/doctor/components/AppointmentModals.tsx'));
  const badFallbacks = findNodes(
    sf,
    (n) =>
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
      (n.left.getText(sf) === 'hours' || n.left.getText(sf) === 'minutes')
  );
  assert.equal(badFallbacks.length, 0, 'hours || ... and minutes || ... falsy coercion breaks 00:xx and HH:00');
  assert.match(code, /Number\.isFinite/);
});

test('T2-F12-02 AppointmentModals validates customTimeInput HH:mm (00-23:00-59)', () => {
  const { code } = parseTsAst(p('features/doctor/components/AppointmentModals.tsx'));
  assert.match(code, /customTimeInput[\s\S]*?(23|hours\s*<\s*0|hours\s*>\s*23|\^\\d\{1,2\}:\\d\{2\}\$|RegExp)/);
});

test('T2-F12-03 AppointmentModals and DoctorPatientsScreen guard against past scheduled_at timestamps', () => {
  const { code: modCode } = parseTsAst(p('features/doctor/components/AppointmentModals.tsx'));
  const { code: patCode } = parseTsAst(p('features/doctor/screens/DoctorPatientsScreen.tsx'));
  assert.ok(
    /getTime\(\)\s*<\s*Date\.now\(\)|<\s*new Date\(\)/.test(modCode) ||
      /getTime\(\)\s*<\s*Date\.now\(\)|<\s*new Date\(\)/.test(patCode),
    'Mobile scheduling must validate against past date/time before submit'
  );
});

test('T2-F12-04 DoctorPatientsScreen surfaces backend 409 conflict detail on error', () => {
  const { code } = parseTsAst(p('features/doctor/screens/DoctorPatientsScreen.tsx'));
  assert.match(code, /handleSaveAppointment[\s\S]*?response\?\.data\?\.detail|409/);
});

test('T2-F12-05 notificationHelpers buildUnifiedNotifications matches 00:30+07:00 (17:30Z prev day) as Khám hôm nay', () => {
  const mod = transpileAndLoad(
    p('features/doctor/components/notifications/notificationHelpers.ts'),
    { '@expo/vector-icons': { Ionicons: { glyphMap: {} } } },
    { fixedNow: '2026-11-22T01:00:00Z' } // 2026-11-22 08:00+07:00
  );
  const list = mod.buildUnifiedNotifications({
    incidents: [],
    warningPatients: [],
    appointments: [
      {
        id: 'apt-0030',
        patient_id: 'p1',
        patient_name: 'Cụ An',
        visit_type: 'HOME_VISIT',
        scheduled_at: '2026-11-21T17:30:00Z', // 2026-11-22 00:30+07:00
        status: 'UPCOMING',
      },
    ],
    upcomingAppointments: [],
    readIds: new Set(),
  });
  const aptNotif = list.find((n) => n.id === 'apt_apt-0030');
  assert.ok(aptNotif);
  assert.equal(aptNotif.badgeLabel, 'Khám hôm nay');
});

// ============================================================================
// Feature #13: Mobile WS Sync, Caches & Patient ID Guard
// ============================================================================

test('T1-F13-01 alertsWS handles APPOINTMENT_SCHEDULED without triggering fall siren or escalation', () => {
  const { alertsWS, incidents, calls } = createWsHarness();
  alertsWS._handleStoreUpdate({
    type: 'ALERT_NEW',
    alert_type: 'APPOINTMENT_SCHEDULED',
    appointment_id: 'apt-101',
    data: { id: 'inc-101', appointment_id: 'apt-101', notes: 'APT:apt-101', message: 'Lịch mới' },
  });
  assert.equal(calls.siren.length, 0);
  assert.equal(calls.escalations.length, 0);
  assert.equal(incidents[0].alert_type, 'APPOINTMENT_SCHEDULED');
  assert.equal(incidents[0].notes, 'APT:apt-101');
});

test('T1-F13-02 alertsWS acknowledges incident on APPOINTMENT_CANCELLED via i.notes containing APT:<uuid>', () => {
  const { alertsWS, calls } = createWsHarness([
    {
      id: 'inc-1',
      alert_type: 'APPOINTMENT_SCHEDULED',
      notes: 'APT:apt-202|PATIENT:pat-1',
      note: null,
      is_acknowledged: false,
    },
  ]);
  alertsWS._handleStoreUpdate({
    type: 'APPOINTMENT_CANCELLED',
    alert_type: 'APPOINTMENT_CANCELLED',
    appointment_id: 'apt-202',
    cancellation_reason: 'Bác sĩ bận',
  });
  assert.equal(calls.acknowledged.length, 1);
  assert.equal(calls.acknowledged[0].id, 'inc-1');
});

test('T1-F13-03 DoctorAppointmentsScreen subscribes to alertsWS, sorts chronologically, and computes isCurrentOrNext accurately', () => {
  const { code } = parseTsAst(p('features/doctor/screens/DoctorAppointmentsScreen.tsx'));
  assert.match(code, /alertsWS\.subscribe/);
  assert.match(code, /\.sort\(/);
  assert.equal(/isCurrentOrNext=\{index === 0 && apt\.status === 'UPCOMING'\}/.test(code), false, 'isCurrentOrNext must not blindly highlight index === 0 regardless of time/sort');
});

test('T1-F13-04 FamilyAppointmentsModal syncs stores after confirmAppointment', () => {
  const { code } = parseTsAst(p('features/dashboard/components/FamilyAppointmentsModal.tsx'));
  assert.match(code, /handleConfirmAppointment[\s\S]*?(useVitalStore|useAlertStore|acknowledgeIncident|fetchNotifications)/);
});

test('T1-F13-05 HomeScreen, AlertsListScreen, PatientMedicalRecordScreen, and mobile api.ts pass real patient UUID without "1" fallback', () => {
  for (const rel of [
    'features/dashboard/screens/HomeScreen.tsx',
    'features/alerts/screens/AlertsListScreen.tsx',
    'features/dashboard/screens/PatientMedicalRecordScreen.tsx',
    'services/api.ts',
  ]) {
    const { code } = parseTsAst(p(rel));
    assert.equal(/patient_id\s*\|\|\s*1\b|patientRecord\?\.id\s*\|\|\s*1\b|patientId:\s*number\s*\|\s*string\s*=\s*1\b/.test(code), false, `${rel} must NOT fall back to hardcoded patient ID 1`);
  }
});

test('T2-F13-01 alertsWS does NOT trigger fall/vital alarm or HIGH incident on APPOINTMENT_DELETED, RESCHEDULED, or COMPLETED', () => {
  for (const alertType of ['APPOINTMENT_DELETED', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_COMPLETED']) {
    const { alertsWS, calls } = createWsHarness();
    alertsWS._handleStoreUpdate({
      type: 'ALERT_NEW',
      alert_type: alertType,
      appointment_id: 'apt-303',
      data: { id: `inc-${alertType}`, message: 'Cập nhật lịch' },
    });
    assert.equal(calls.siren.length, 0, `${alertType} must NEVER activate siren`);
    assert.equal(calls.escalations.length, 0, `${alertType} must NEVER trigger fall escalation`);
    assert.equal(
      calls.notifications.some((n) => /SINH TỒN|TÉ NGÃ/i.test(n.title || '')),
      false,
      `${alertType} must NOT route into vital/fall emergency notification`
    );
    assert.equal(
      calls.added.some((inc) => inc.alert_level === 'HIGH' || inc.alert_level === 'CRITICAL'),
      false,
      `${alertType} must NOT create HIGH/CRITICAL emergency incident`
    );
  }
});

test('T2-F13-02 alertsWS resolves appointment incident on INCIDENT_RESOLVED by incident_id or appointment_id', () => {
  const { alertsWS, calls } = createWsHarness([
    { id: 'inc-real-1', alert_type: 'APPOINTMENT_SCHEDULED', notes: 'APT:apt-404', is_acknowledged: false },
  ]);
  alertsWS._handleStoreUpdate({
    type: 'INCIDENT_RESOLVED',
    incident_id: 'inc-real-1',
    appointment_id: 'apt-404',
    data: { id: 'inc-real-1', is_acknowledged: true },
  });
  assert.equal(calls.acknowledged.length, 1);
  assert.equal(calls.acknowledged[0].id, 'inc-real-1');
});

test('T2-F13-03 alertsWS skips self-initiated APPOINTMENT_REQUESTED notification banner for same creator', () => {
  const { alertsWS, calls } = createWsHarness([], { userId: 'fam-user-1', user_id: 'fam-user-1', role: 'owner', viewRole: 'FAMILY' });
  alertsWS._handleStoreUpdate({
    type: 'APPOINTMENT_SCHEDULED',
    alert_type: 'APPOINTMENT_REQUESTED',
    appointment_id: 'apt-505',
    data: {
      id: 'inc-req-1',
      appointment_id: 'apt-505',
      created_by: 'fam-user-1',
      notes: 'PATIENT:p1|APPOINTMENT_REQUESTED|APT:apt-505',
      message: 'Người nhà đã đặt lịch khám',
    },
  });
  assert.equal(calls.notifications.length, 0, 'Requesting family user must NOT receive a duplicate self-notification banner');
});

test('T2-F13-04 DoctorHomeScreen clears AsyncStorage nextAppointment when nextAptObj is null', () => {
  const { code } = parseTsAst(p('features/doctor/screens/DoctorHomeScreen.tsx'));
  assert.equal(/nextAppointment:\s*nextAptObj\s*\?\?\s*prev\.nextAppointment/.test(code), false, 'DoctorHomeScreen must NOT retain stale prev.nextAppointment when nextAptObj is null');
});

test('T2-F13-05 Mobile family screens & api.ts have zero hardcoded numeric 1 or "1" patientId fallbacks', () => {
  const recordCode = parseTsAst(p('features/dashboard/screens/PatientMedicalRecordScreen.tsx')).code;
  assert.equal(/fetchPatientRecord\(\s*1\s*,|updatePatientRecord\(\s*1\s*,|enrollPatientFace\(\s*1\s*,/.test(recordCode), false, 'PatientMedicalRecordScreen must NOT hardcode fallback ID 1');
  const apiCode = parseTsAst(p('services/api.ts')).code;
  assert.equal(/completeAppointment:\s*\(\s*appointmentId:\s*string\s*\)\s*=>/.test(apiCode), false, 'mobile doctorApi.completeAppointment should accept optional clinicalNotes');
});
