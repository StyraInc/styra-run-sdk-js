import StyraRun from "./run-sdk.js"
import rbac from "./rbac.js"

// I haven't done any SDK work, but is it appropriate to make this global instead of the user just importing it?
global.StyraRun = StyraRun
global.StyraRun.renderRbacManagement = rbac.render

export default StyraRun