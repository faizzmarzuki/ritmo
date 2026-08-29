import { migrate } from '../src/db/index.js'
const n = migrate()
console.log(`migrations up to date (${n} file(s) known)`)
