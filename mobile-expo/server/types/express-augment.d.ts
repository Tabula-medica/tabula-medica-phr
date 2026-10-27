import "express-serve-static-core";
import "qs";

declare module "qs" {
  interface ParsedQs {
    [key: string]: any;
  }
}

declare module "express-serve-static-core" {
  interface ParamsDictionary {
    [key: string]: any;
  }
  interface Request {
    body: any;
    headers: any;
  }
}

export {};
