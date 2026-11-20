const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Transpile usePatientStore.ts
const tsSource = readFileSync(join(__dirname, '../usePatientStore.ts'), 'utf8');
const jsSource = ts.transpileModule(tsSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;

function createStoreHarness(apiOverrides = {}) {
  const mockRemindersApi = {
    getToday: async () => ({
      data: {
        date: '2026-11-20',
        total_medications: 3,
        completed_medications: 1,
        medications: [
          {
            id: 'rx-med-1-0800',
            name: 'Amlodipine 5mg',
            time: '08:00',
            session: 'MORNING',
            dose: '1 viên/lần',
            quantity: '30 viên',
            instructions: 'Uống sau ăn 15 phút',
            purpose: 'Huyết áp',
            taken: true,
            takenAt: '08:15',
          },
          {
            id: 'rx-med-2-1200',
            name: 'Metformin 500mg',
            time: '12:00',
            session: 'NOON',
            dose: '1 viên/lần',
            quantity: '30 viên',
            instructions: 'Uống trong bữa ăn',
            purpose: 'Tiểu đường',
            taken: false,
            takenAt: null,
          },
          {
            id: 'rx-med-3-2000',
            name: 'Atorvastatin 10mg',
            time: '20:00',
            session: 'EVENING',
            dose: '1 viên/lần',
            quantity: '30 viên',
            instructions: 'Uống trước khi đi ngủ',
            purpose: 'Mỡ máu',
            taken: false,
            takenAt: null,
          },
        ],
        meals: [],
        doctor_prescriptions: [
          {
            id: 1,
            medication_name: 'Amlodipine 5mg',
            dosage: '1 viên/lần',
            instructions: 'Uống sau ăn 15 phút',
            schedule_times: ['08:00'],
          },
        ],
      },
    }),
    toggle: async () => ({ status: 'success' }),
    ...apiOverrides.remindersApi,
  };

  const mockPatientApi = {
    list: async () => ({ data: [] }),
    create: async () => ({ data: {} }),
    delete: async () => ({ data: { success: true } }),
    getRecord: async () => ({ data: {} }),
    updateRecord: async () => ({ data: {} }),
    enrollFace: async () => ({ data: {} }),
    ...apiOverrides.patientApi,
  };

  const zustand = require(join(__dirname, '../../../node_modules/zustand'));

  const customRequire = (id) => {
    if (id === 'zustand') return zustand;
    if (id === '../services/api') {
      return {
        remindersApi: mockRemindersApi,
        patientApi: mockPatientApi,
      };
    }
    return require(id);
  };

  const moduleObj = { exports: {} };
  const context = vm.createContext({
    require: customRequire,
    module: moduleObj,
    exports: moduleObj.exports,
    console,
    Date,
    String,
    Array,
    Boolean,
    setTimeout,
    clearTimeout,
  });

  vm.runInContext(jsSource, context);
  return {
    usePatientStore: moduleObj.exports.usePatientStore,
    remindersApi: mockRemindersApi,
    patientApi: mockPatientApi,
  };
}

test('fetchReminders accurately maps instructions and session details from backend API', async () => {
  const { usePatientStore } = createStoreHarness();
  const store = usePatientStore.getState();

  const data = await store.fetchReminders('patient-123');
  assert.ok(data !== null, 'Returned data should not be null');
  assert.equal(data.total_medications, 3);
  assert.equal(data.completed_medications, 1);

  const med1 = data.medications.find((m) => m.id === 'rx-med-1-0800');
  assert.equal(med1.name, 'Amlodipine 5mg');
  assert.equal(med1.instructions, 'Uống sau ăn 15 phút', 'Instructions must be correctly mapped to ReminderItem.instructions');
  assert.equal(med1.session, 'MORNING');
  assert.equal(med1.taken, true);
  assert.equal(med1.takenAt, '08:15');

  const med2 = data.medications.find((m) => m.id === 'rx-med-2-1200');
  assert.equal(med2.instructions, 'Uống trong bữa ăn');
  assert.equal(med2.session, 'NOON');
  assert.equal(med2.taken, false);
  assert.equal(med2.takenAt, undefined);

  const med3 = data.medications.find((m) => m.id === 'rx-med-3-2000');
  assert.equal(med3.instructions, 'Uống trước khi đi ngủ');
  assert.equal(med3.session, 'EVENING');
});

test('session breakdown and filtering matches MedicationReminderScreen logic', async () => {
  const { usePatientStore } = createStoreHarness();
  const store = usePatientStore.getState();
  const data = await store.fetchReminders('patient-123');

  const medications = data.medications;
  const morningCount = medications.filter((m) => m.session === 'MORNING').length;
  const morningDone = medications.filter((m) => m.session === 'MORNING' && m.taken).length;
  const noonCount = medications.filter((m) => m.session === 'NOON').length;
  const noonDone = medications.filter((m) => m.session === 'NOON' && m.taken).length;
  const eveningCount = medications.filter((m) => m.session === 'EVENING').length;
  const eveningDone = medications.filter((m) => m.session === 'EVENING' && m.taken).length;

  assert.equal(morningCount, 1);
  assert.equal(morningDone, 1);
  assert.equal(noonCount, 1);
  assert.equal(noonDone, 0);
  assert.equal(eveningCount, 1);
  assert.equal(eveningDone, 0);

  // Filter test
  const morningOnly = medications.filter((m) => m.session === 'MORNING');
  assert.equal(morningOnly.length, 1);
  assert.equal(morningOnly[0].name, 'Amlodipine 5mg');

  const noonOnly = medications.filter((m) => m.session === 'NOON');
  assert.equal(noonOnly.length, 1);
  assert.equal(noonOnly[0].name, 'Metformin 500mg');
});

test('clean empty state when no medications or prescriptions exist (zero fake data)', async () => {
  const { usePatientStore } = createStoreHarness({
    remindersApi: {
      getToday: async () => ({
        data: {
          date: '2026-11-20',
          total_medications: 0,
          completed_medications: 0,
          medications: [],
          meals: [],
          doctor_prescriptions: [],
        },
      }),
    },
  });
  const store = usePatientStore.getState();

  const data = await store.fetchReminders('patient-empty');
  assert.ok(data !== null);
  assert.equal(data.total_medications, 0);
  assert.equal(data.completed_medications, 0);
  assert.deepEqual(data.medications, []);
  assert.deepEqual(data.doctor_prescriptions, []);
});

test('markMedicationTaken optimistic update succeeds when server toggle succeeds', async () => {
  let toggleCalledWith = null;
  const { usePatientStore } = createStoreHarness({
    remindersApi: {
      toggle: async (id, patientId) => {
        toggleCalledWith = { id, patientId };
        return { status: 'success', taken: true };
      },
    },
  });

  const store = usePatientStore.getState();
  await store.fetchReminders('patient-123');

  // Mark Noon dose as taken
  await store.markMedicationTaken('rx-med-2-1200', true, '12:15', 'patient-123');

  const updatedState = usePatientStore.getState().todayReminders;
  assert.equal(toggleCalledWith?.id, 'rx-med-2-1200');
  assert.equal(toggleCalledWith?.patientId, 'patient-123');

  const med = updatedState.medications.find((m) => m.id === 'rx-med-2-1200');
  assert.equal(med.taken, true);
  assert.equal(med.takenAt, '12:15');
  assert.equal(updatedState.completed_medications, 2); // Was 1, now 2
});

test('markMedicationTaken rolls back optimistic update when server toggle fails (zero silent desync)', async () => {
  const { usePatientStore } = createStoreHarness({
    remindersApi: {
      toggle: async () => {
        throw new Error('500 Server Error: Failed to toggle reminder in Redis');
      },
    },
  });

  const store = usePatientStore.getState();
  await store.fetchReminders('patient-123');

  // Verify baseline before toggle
  const initialMed = usePatientStore.getState().todayReminders.medications.find((m) => m.id === 'rx-med-2-1200');
  assert.equal(initialMed.taken, false);
  assert.equal(usePatientStore.getState().todayReminders.completed_medications, 1);

  // Attempt to mark as taken, expect rejection and rollback
  await assert.rejects(
    async () => {
      await store.markMedicationTaken('rx-med-2-1200', true, '12:15', 'patient-123');
    },
    {
      name: 'Error',
      message: '500 Server Error: Failed to toggle reminder in Redis',
    }
  );

  // Verify state rolled back to false and count is 1
  const stateAfterRollback = usePatientStore.getState().todayReminders;
  const rolledBackMed = stateAfterRollback.medications.find((m) => m.id === 'rx-med-2-1200');
  assert.equal(rolledBackMed.taken, false, 'Medication taken state must be rolled back to false');
  assert.equal(rolledBackMed.takenAt, undefined, 'Medication takenAt must be reverted to undefined');
  assert.equal(stateAfterRollback.completed_medications, 1, 'completed_medications must be reverted to 1');
});

test('markMedicationTaken rolls back when un-marking taken dose fails on server', async () => {
  const { usePatientStore } = createStoreHarness({
    remindersApi: {
      toggle: async () => {
        throw new Error('404 Not Found: Reminder dose not found');
      },
    },
  });

  const store = usePatientStore.getState();
  await store.fetchReminders('patient-123');

  // Medication 1 is taken: true initially
  const med1 = usePatientStore.getState().todayReminders.medications.find((m) => m.id === 'rx-med-1-0800');
  assert.equal(med1.taken, true);
  assert.equal(med1.takenAt, '08:15');

  // Attempt to un-mark dose
  await assert.rejects(
    async () => {
      await store.markMedicationTaken('rx-med-1-0800', false, undefined, 'patient-123');
    },
    {
      name: 'Error',
      message: '404 Not Found: Reminder dose not found',
    }
  );

  // Must rollback to taken: true, takenAt: '08:15'
  const stateAfterRollback = usePatientStore.getState().todayReminders;
  const revertedMed = stateAfterRollback.medications.find((m) => m.id === 'rx-med-1-0800');
  assert.equal(revertedMed.taken, true, 'Medication taken must revert back to true');
  assert.equal(revertedMed.takenAt, '08:15', 'Medication takenAt must revert back to 08:15');
  assert.equal(stateAfterRollback.completed_medications, 1, 'completed_medications must remain 1');
});
