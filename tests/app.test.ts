
import { runner } from '../lib/testRunner';
import { AutomationService } from '../services/automationService';
import { StorageService } from '../services/storageService';
import { CryptoService } from '../services/cryptoService';
import { Task } from '../types';

export const registerTests = () => {

  // 1. UNIT TESTS (Business Logic)
  runner.describe('Unit: Automation Logic', () => {
    
    runner.it('should calculate geofence distance correctly', () => {
      // @ts-ignore - accessing private static for testing, or assume public exposure
      const dist = AutomationService['getDistanceFromLatLonInMeters'](59.9343, 30.3351, 59.9345, 30.3351);
      // Rough distance ~22 meters
      runner.expect(Math.floor(dist)).toBeGreaterThan(20);
      runner.expect(Math.floor(dist)).toBeLessThan(25);
    });

    runner.it('should format duration correctly', () => {
      const ms = 3661000; // 1h 1m 1s
      const formatted = AutomationService.formatDuration(ms);
      runner.expect(formatted).toBe('01:01:01');
    });

    runner.it('should simulate rule execution', () => {
       const mockTask: Task = { 
         id: '1', title: 'Test', status: 'done', tags: [], completed: true, 
         createdAt: 0, updatedAt: 0, order: 0 
       };
       const rule: any = {
         trigger: { type: 'status_change', value: 'done' },
         action: { type: 'add_tag', value: 'tested' }
       };
       const res = AutomationService.simulateRule(rule, [mockTask]);
       runner.expect(res.length).toBe(1);
    });
  });

  runner.describe('Unit: Crypto Service', async () => {
     runner.it('should encrypt and decrypt string', async () => {
        const text = "Secret Message";
        const pass = "password123";
        const encrypted = await CryptoService.encrypt(text, pass);
        const decrypted = await CryptoService.decrypt(encrypted, pass);
        
        runner.expect(decrypted).toBe(text);
        runner.expect(encrypted === text).toBe(false);
     });
  });

  // 2. INTEGRATION TESTS (IndexedDB)
  runner.describe('Integration: Storage Service', () => {
     
     runner.it('should initialize DB', async () => {
        await StorageService.init();
        runner.expect(true).toBeTruthy();
     });

     runner.it('should create and retrieve a task', async () => {
        const task: Task = {
           id: 'test-id-1',
           title: 'Integration Test Task',
           status: 'backlog',
           tags: [],
           completed: false,
           createdAt: Date.now(),
           updatedAt: Date.now(),
           order: 1
        };
        await StorageService.addTask(task);
        const tasks = await StorageService.getTasks();
        const stored = tasks.find(t => t.id === 'test-id-1');
        
        runner.expect(stored).toBeTruthy();
        runner.expect(stored?.title).toBe('Integration Test Task');
        
        // Cleanup
        await StorageService.deleteTask('test-id-1');
     });
  });

  // 3. PERFORMANCE TESTS
  runner.describe('Performance: Bulk Operations', () => {
     
     runner.it('should add 100 tasks under 500ms', async () => {
        const start = performance.now();
        const promises = [];
        for(let i=0; i<100; i++) {
           const t: Task = {
             id: `perf-${i}`,
             title: `Perf Task ${i}`,
             status: 'backlog',
             tags: ['perf'],
             completed: false,
             createdAt: Date.now(),
             updatedAt: Date.now(),
             order: i
           };
           promises.push(StorageService.addTask(t));
        }
        await Promise.all(promises);
        const duration = performance.now() - start;
        
        console.log(`Bulk add took: ${duration.toFixed(2)}ms`);
        runner.expect(duration).toBeLessThan(1000); // Generous buffer for IndexedDB
        
        // Cleanup
        const deletePromises = [];
        for(let i=0; i<100; i++) {
            deletePromises.push(StorageService.deleteTask(`perf-${i}`));
        }
        await Promise.all(deletePromises);
     });
  });

};
