
import { MonitoringService } from "../services/monitoringService";

type TestFn = () => Promise<void> | void;

interface TestCase {
  description: string;
  fn: TestFn;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
}

export class TestRunner {
  private suites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  // --- DSL ---
  
  describe(name: string, fn: () => void) {
    this.currentSuite = { name, tests: [] };
    this.suites.push(this.currentSuite);
    fn();
  }

  it(description: string, fn: TestFn) {
    if (this.currentSuite) {
      this.currentSuite.tests.push({ description, fn });
    }
  }

  expect(actual: any) {
    return {
      toBe: (expected: any) => {
        if (actual !== expected) throw new Error(`Expected ${expected} but got ${actual}`);
      },
      toEqual: (expected: any) => {
        const aStr = JSON.stringify(actual);
        const eStr = JSON.stringify(expected);
        if (aStr !== eStr) throw new Error(`Expected ${eStr} but got ${aStr}`);
      },
      toBeTruthy: () => {
        if (!actual) throw new Error(`Expected ${actual} to be truthy`);
      },
      toBeGreaterThan: (expected: number) => {
        if (actual <= expected) throw new Error(`Expected ${actual} > ${expected}`);
      },
      toBeLessThan: (expected: number) => {
        if (actual >= expected) throw new Error(`Expected ${actual} < ${expected}`);
      }
    };
  }

  // --- Execution ---

  async run() {
    console.clear();
    console.log('%c🧪 Starting Test Suite...', 'font-size: 14px; font-weight: bold; color: #3b82f6');
    
    let totalPass = 0;
    let totalFail = 0;
    const results: any[] = [];

    const startTime = performance.now();

    for (const suite of this.suites) {
      console.group(`📂 ${suite.name}`);
      const suiteResult = { name: suite.name, tests: [] as any[] };

      for (const test of suite.tests) {
        const testStart = performance.now();
        try {
          await test.fn();
          const duration = performance.now() - testStart;
          console.log(`%c✔ ${test.description} (${duration.toFixed(2)}ms)`, 'color: green');
          suiteResult.tests.push({ name: test.description, status: 'pass', duration });
          totalPass++;
        } catch (e: any) {
          const duration = performance.now() - testStart;
          console.error(`✘ ${test.description}`, e.message);
          suiteResult.tests.push({ name: test.description, status: 'fail', error: e.message, duration });
          totalFail++;
        }
      }
      results.push(suiteResult);
      console.groupEnd();
    }

    const totalTime = performance.now() - startTime;
    console.log(`%c\nDone in ${totalTime.toFixed(2)}ms. Passed: ${totalPass}, Failed: ${totalFail}`, 
      totalFail > 0 ? 'color: red; font-weight: bold' : 'color: green; font-weight: bold'
    );

    return { results, totalPass, totalFail, totalTime };
  }
}

export const runner = new TestRunner();
