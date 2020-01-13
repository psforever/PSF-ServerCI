import app_config from "./app_config.js"
import winston from "winston"

let {createLogger, format, transports} = winston

const myFormat = format.printf((info) => {
	const { level, message, label, timestamp, metadata } = info;
	const rest = JSON.stringify(metadata);

	if (rest != '{}')
		return `${timestamp}: [${level}] ${message} ${rest}`;
	else
		return `${timestamp}: [${level}] ${message}`;
});

const logger = createLogger({
	level: app_config.log_level,
	format: format.combine(
		format.metadata(),
		format.splat(),
		format.timestamp(),
		myFormat,
	),
	defaultMeta : {},
	transports: [
		new transports.File({ filename: 'error.log', level: 'error' }),
		new transports.File({ filename: 'combined.log' })
	]
});

logger.add(new transports.Console({
	defaultMeta : {},
	format: format.combine(
		format.cli(),
		myFormat,
	),
}));

export default logger
