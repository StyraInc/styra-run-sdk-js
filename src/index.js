import StyraRun from "./run-sdk.js"
import rbac from "./rbac.js"
global.StyraRun = StyraRun
global.StyraRun.setupRbacManagement = rbac.setup
export default StyraRun