import winston from "winston";

const devConsoleFormat = winston.format.combine(
  winston.format.colorize({
    all: true,
  }),
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss",
  }),
  winston.format.simple(),
  winston.format.splat(),
  winston.format.printf(
    ({ timestamp, level, message, ...data }) =>
      `\n[${timestamp}] [${level}]: ${message} ${
        Object.keys(data).length ? "\n" + JSON.stringify(data, null, 2) : ""
      }`
  )
);

const prodConsoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.splat(),
  winston.format.json()
);

export default winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "verbose",
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === "production" ? prodConsoleFormat : devConsoleFormat
  ),
  transports: [new winston.transports.Console({})],
});
