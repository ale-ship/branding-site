// What the request-context middleware adds to every request (middleware/requestId.js).
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    log: import('pino').Logger;
  }
}
