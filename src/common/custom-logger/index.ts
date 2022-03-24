import log4js from "log4js";

const CustomLogger = log4js.getLogger("qonto");
CustomLogger.level = "info";

export default CustomLogger;
