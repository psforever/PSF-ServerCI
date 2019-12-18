import app_config from "./app_config.js"
import winston from "winston"

let {createLogger, format, transports} = winston

const logger = createLogger({
	level: app_config.log_level,
	format: format.combine(
		format.splat(),
		format.simple()
	),
	defaultMeta : {},
	transports: [
		new transports.File({ filename: 'error.log', level: 'error' }),
		new transports.File({ filename: 'combined.log' })
	]
});
 
//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
	defaultMeta : {},
	  format: format.combine(
		format.splat(),
	  ),
  }));
}

export default logger
