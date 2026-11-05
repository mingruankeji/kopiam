import axios, { type AxiosResponse } from "axios";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { KopiaService } from "../../src/core/kopiaService";

vi.mock("axios", () => ({
  default: vi.fn(),
  isAxiosError: vi.fn()
}));

const mockedAxios = vi.mocked(axios);

describe("KopiaService API requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '<meta name="kopia-csrf-token" content="csrf-test-token" />';
    mockedAxios.mockResolvedValue({ data: { connected: true } } as AxiosResponse);
  });

  test.each([
    [true, "/api/v1/cli"],
    [false, "/api/primary/v1/cli"]
  ] as const)("loads CLI information from the current server (embedded=%s)", async (embedded, url) => {
    const service = new KopiaService("primary", vi.fn(), undefined, embedded);
    await service.getCLIInfo();
    expect(mockedAxios).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", url }));
  });

  test("uses the same-origin Kopia API and CSRF token in embedded mode", async () => {
    const service = new KopiaService("main", vi.fn(), undefined, true);

    await service.getStatus();

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/v1/repo/status",
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "csrf-test-token" })
      })
    );
  });

  test("keeps the configured server prefix in multi-server mode", async () => {
    const service = new KopiaService("primary", vi.fn());

    await service.getStatus();

    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/api/primary/v1/repo/status",
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "csrf-test-token" })
      })
    );
  });

  test("attaches the current CSRF token to every request method", async () => {
    const service = new KopiaService("main", vi.fn(), undefined, true);
    await service.cancelTask("task-1");
    await service.setPreferences({
      bytesStringBase2: true,
      defaultSnapshotViewAll: false,
      fontSize: "fs-6",
      pageSize: 20,
      theme: "dark",
      language: "",
      locale: "zh"
    });
    document.querySelector<HTMLMetaElement>('meta[name="kopia-csrf-token"]')!.content = "new-token";
    await service.unMountSnapshot("object-1");

    expect(mockedAxios.mock.calls.map(([request]) => request)).toEqual([
      expect.objectContaining({
        method: "POST",
        url: "/api/v1/tasks/task-1/cancel",
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "csrf-test-token" })
      }),
      expect.objectContaining({
        method: "PUT",
        url: "/api/v1/ui-preferences",
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "csrf-test-token" })
      }),
      expect.objectContaining({
        method: "DELETE",
        url: "/api/v1/mounts/object-1",
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "new-token" })
      })
    ]);
  });

  test("encodes object downloads without an instance prefix in embedded mode", () => {
    const service = new KopiaService("main", vi.fn(), undefined, true);
    expect(service.getObjectDownloadUrl("object-1", "中文 & notes.txt")).toBe(
      "/api/v1/objects/object-1?fname=%E4%B8%AD%E6%96%87%20%26%20notes.txt"
    );
  });

  test("cancels the exact snapshot source using the same-origin API", async () => {
    const service = new KopiaService("main", vi.fn(), undefined, true);
    const source = { userName: "user", host: "host", path: "D:\\中文 & 备份" };
    await service.cancelSnapshot(source);
    expect(mockedAxios).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "/api/v1/sources/cancel",
        params: source,
        headers: expect.objectContaining({ "X-Kopia-Csrf-Token": "csrf-test-token" })
      })
    );
  });
});
