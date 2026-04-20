import { describe, it, expect } from "vitest";
import { SwarmHQError, ConfigError, ConnectivityError } from "../errors.js";

describe("SwarmHQError", () => {
  it("has default exitCode of 1", () => {
    const err = new SwarmHQError("something failed");
    expect(err.exitCode).toBe(1);
    expect(err.message).toBe("something failed");
  });

  it("accepts a custom exitCode", () => {
    const err = new SwarmHQError("custom", 5);
    expect(err.exitCode).toBe(5);
  });

  it("is an instance of Error", () => {
    expect(new SwarmHQError("x")).toBeInstanceOf(Error);
  });
});

describe("ConfigError", () => {
  it("has exitCode 2", () => {
    const err = new ConfigError("bad config");
    expect(err.exitCode).toBe(2);
  });

  it("is an instance of SwarmHQError and Error", () => {
    const err = new ConfigError("bad config");
    expect(err).toBeInstanceOf(SwarmHQError);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name ConfigError", () => {
    expect(new ConfigError("x").name).toBe("ConfigError");
  });
});

describe("ConnectivityError", () => {
  it("has exitCode 3", () => {
    const err = new ConnectivityError("ssh failed");
    expect(err.exitCode).toBe(3);
  });

  it("is an instance of SwarmHQError and Error", () => {
    const err = new ConnectivityError("ssh failed");
    expect(err).toBeInstanceOf(SwarmHQError);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name ConnectivityError", () => {
    expect(new ConnectivityError("x").name).toBe("ConnectivityError");
  });
});
