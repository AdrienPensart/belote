import journal from './meta/_journal.json';
import m0000 from './0000_crazy_the_captain.sql';
import m0001 from './0001_seed-users.sql';
import m0002 from './0002_seed-coinche-users.sql';
import m0003 from './0003_seed-history-test.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003
    }
  }
  