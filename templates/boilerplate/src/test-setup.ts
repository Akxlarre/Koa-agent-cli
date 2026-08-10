import '@analogjs/vitest-angular/setup-zone';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// Sin esto, Angular lanza "Need to call TestBed.initTestEnvironment() first"
// en TODO spec que use TestBed — importar setup-zone solo no alcanza.
setupTestBed({ zoneless: false });
