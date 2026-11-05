import axios from "axios";
import { kopiaRequestHeaders } from "./clientApiFetch";
import type {
  AlgorithmsList,
  ApiResponse,
  CheckRepoRequest,
  ConnectRepoRequest,
  CreateSnapshotRequest,
  CurrentUser,
  DeleteSnapshotRequest,
  DirManifest,
  EstimateSnapshotRequest,
  LogEntry,
  MountedSnapshot,
  MountSnapshotRequest,
  MountsResponse,
  NotificationProfile,
  PoliciesList,
  Policy,
  Preferences,
  ResolvedPolicy,
  ResolvePath,
  ResolvePolicyRequest,
  RestoreRequest,
  Snapshot,
  Snapshots,
  SourceInfo,
  Sources,
  Status,
  Task,
  TaskList,
  TasksSummary
} from "./types";

type QueryParams = { [key: string]: string | boolean | number };
export type KopiaAuth = {
  username: string;
  password: string;
};
export interface IKopiaService {
  getCLIInfo(): Promise<ApiResponse<{ executable: string }>>;
  getSnapshots(): Promise<ApiResponse<Sources>>;
  startSnapshot(sourceInfo: SourceInfo): Promise<ApiResponse<Task>>;
  cancelSnapshot(sourceInfo: SourceInfo): Promise<ApiResponse<unknown>>;
  getSnapshot(query: { [key: string]: string }): Promise<ApiResponse<Snapshots>>;
  updateDescription(snapshotIds: string[], description: string): Promise<ApiResponse<Snapshot[]>>;
  addPin(snapshotId: string, pin: string): Promise<ApiResponse<Snapshot[]>>;
  updatePin(snapshotId: string, currentPin: string, pin: string): Promise<ApiResponse<Snapshot[]>>;
  removePin(snapshotId: string, pin: string): Promise<ApiResponse<Snapshot[]>>;
  getObjects(oid: string): Promise<ApiResponse<DirManifest>>;
  getObjectDownloadUrl(oid: string, filename: string): string;
  restore(data: RestoreRequest): Promise<ApiResponse<Task>>;
  getTasks(): Promise<ApiResponse<TaskList>>;
  getTask(taskId: string): Promise<ApiResponse<Task>>;
  cancelTask(taskId: string): Promise<ApiResponse<unknown>>;
  getTaskLogs(taskId: string): Promise<
    ApiResponse<{
      logs: LogEntry[] | null;
    }>
  >;
  getStatus(): Promise<ApiResponse<Status>>;
  getPolicies(): Promise<ApiResponse<PoliciesList>>;
  getAlgorithms(): Promise<ApiResponse<AlgorithmsList>>;
  getPolicy(source: SourceInfo): Promise<ApiResponse<Policy>>;
  savePolicy(policy: Policy, source: SourceInfo): Promise<ApiResponse<Policy>>;
  deletePolicy(sourceInfo: SourceInfo): Promise<ApiResponse<unknown>>;
  getTasksSummary(): Promise<ApiResponse<TasksSummary>>;
  resolvePolicy(source: SourceInfo, data: ResolvePolicyRequest): Promise<ApiResponse<ResolvedPolicy>>;
  getPreferences(): Promise<ApiResponse<Preferences>>;
  setPreferences(data: Preferences): Promise<ApiResponse<Preferences>>;
  getNotificationProfiles(): Promise<ApiResponse<NotificationProfile[]>>;
  createNotificationProfile(profile: NotificationProfile): Promise<ApiResponse<NotificationProfile>>;

  deleteNotificationProfile(profileName: string): Promise<ApiResponse<unknown>>;
  testNotificationProfile(profile: NotificationProfile): Promise<ApiResponse<unknown>>;

  resolvePath(path: string): Promise<ApiResponse<ResolvePath>>;
  estimateSnapshot(data: EstimateSnapshotRequest): Promise<ApiResponse<Task>>;
  createSnapshot(data: CreateSnapshotRequest): Promise<ApiResponse<Task>>;
  getCurrentUser(): Promise<ApiResponse<CurrentUser>>;
  repoExists(data: CheckRepoRequest): Promise<ApiResponse<unknown>>;
  connectRepo(data: ConnectRepoRequest): Promise<ApiResponse<unknown>>;
  createRepo(data: object): Promise<ApiResponse<unknown>>;
  disconnectRepo(): Promise<ApiResponse<unknown>>;
  updateRepoDescription(description: string): Promise<ApiResponse<unknown>>;
  deleteSnapshot(data: DeleteSnapshotRequest): Promise<ApiResponse<unknown>>;
  syncRepo(): Promise<ApiResponse<unknown>>;
  login(username: string, password: string): Promise<ApiResponse<Status>>;
  mountSnapshot(root: string): Promise<ApiResponse<MountedSnapshot>>;
  getMountedSnapshot(root: string): Promise<ApiResponse<MountedSnapshot>>;
  unMountSnapshot(root: string): Promise<ApiResponse<unknown>>;
  getMountedSnapshots(): Promise<ApiResponse<MountsResponse>>;
}

export class KopiaService implements IKopiaService {
  private apiPrefix: string;
  private authInfo?: KopiaAuth;
  private onAuthRequired: () => void;
  constructor(instance: string, onAuthRequired: () => void, authInfo?: KopiaAuth, kopiaEmbedded = false) {
    this.apiPrefix = kopiaEmbedded ? "/api/v1" : `/api/${instance}/v1`;
    this.onAuthRequired = onAuthRequired;
    this.authInfo = authInfo;
  }

  public getSnapshots(): Promise<ApiResponse<Sources>> {
    return this.get(`${this.apiPrefix}/sources`);
  }

  public getCLIInfo(): Promise<ApiResponse<{ executable: string }>> {
    return this.get(`${this.apiPrefix}/cli`);
  }

  public startSnapshot(sourceInfo: SourceInfo): Promise<ApiResponse<Task>> {
    return this.post(`${this.apiPrefix}/sources/upload`, undefined, sourceInfo);
  }
  public cancelSnapshot(sourceInfo: SourceInfo): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/sources/cancel`, undefined, sourceInfo);
  }
  public getSnapshot(query: { [key: string]: string }): Promise<ApiResponse<Snapshots>> {
    return this.get(`${this.apiPrefix}/snapshots`, query);
  }
  public updateDescription(snapshotIds: string[], description: string): Promise<ApiResponse<Snapshot[]>> {
    return this.post(`${this.apiPrefix}/snapshots/edit`, {
      description,
      snapshots: snapshotIds
    });
  }
  public addPin(snapshotId: string, pin: string): Promise<ApiResponse<Snapshot[]>> {
    return this.post(`${this.apiPrefix}/snapshots/edit`, {
      addPins: [pin],
      removePins: [],
      snapshots: [snapshotId]
    });
  }
  public updatePin(snapshotId: string, currentPin: string, pin: string): Promise<ApiResponse<Snapshot[]>> {
    return this.post(`${this.apiPrefix}/snapshots/edit`, {
      addPins: [pin],
      removePins: [currentPin],
      snapshots: [snapshotId]
    });
  }
  public removePin(snapshotId: string, pin: string): Promise<ApiResponse<Snapshot[]>> {
    return this.post(`${this.apiPrefix}/snapshots/edit`, {
      removePins: [pin],
      snapshots: [snapshotId]
    });
  }
  public getObjects(oid: string): Promise<ApiResponse<DirManifest>> {
    return this.get(`${this.apiPrefix}/objects/${oid}`);
  }

  public getObjectDownloadUrl(oid: string, filename: string): string {
    return `${this.apiPrefix}/objects/${encodeURIComponent(oid)}?fname=${encodeURIComponent(filename)}`;
  }

  public restore(data: RestoreRequest): Promise<ApiResponse<Task>> {
    return this.post(`${this.apiPrefix}/restore`, data);
  }
  public getTasks(): Promise<ApiResponse<TaskList>> {
    return this.get(`${this.apiPrefix}/tasks`);
  }
  public getTask(taskId: string): Promise<ApiResponse<Task>> {
    return this.get(`${this.apiPrefix}/tasks/${taskId}`);
  }
  public cancelTask(taskId: string): Promise<ApiResponse<Task>> {
    return this.post(`${this.apiPrefix}/tasks/${taskId}/cancel`);
  }
  public getTaskLogs(taskId: string): Promise<
    ApiResponse<{
      logs: LogEntry[] | null;
    }>
  > {
    return this.get(`${this.apiPrefix}/tasks/${taskId}/logs`);
  }
  public getStatus(): Promise<ApiResponse<Status>> {
    return this.get(`${this.apiPrefix}/repo/status`);
  }
  public login(username: string, password: string): Promise<ApiResponse<Status>> {
    return this.get(`${this.apiPrefix}/repo/status`, undefined, {
      username,
      password
    });
  }
  public getPolicies(): Promise<ApiResponse<PoliciesList>> {
    return this.get(`${this.apiPrefix}/policies`);
  }

  public getAlgorithms(): Promise<ApiResponse<AlgorithmsList>> {
    return this.get(`${this.apiPrefix}/repo/algorithms`);
  }
  public getPolicy(source: SourceInfo): Promise<ApiResponse<Policy>> {
    return this.get(`${this.apiPrefix}/policy`, source);
  }
  public savePolicy(policy: Policy, source: SourceInfo): Promise<ApiResponse<Policy>> {
    return this.put(`${this.apiPrefix}/policy`, policy, source);
  }
  public deletePolicy(source: SourceInfo): Promise<ApiResponse<unknown>> {
    return this.delete(`${this.apiPrefix}/policy`, source);
  }
  public getTasksSummary(): Promise<ApiResponse<TasksSummary>> {
    return this.get(`${this.apiPrefix}/tasks-summary`);
  }
  public resolvePolicy(source: SourceInfo, data: ResolvePolicyRequest): Promise<ApiResponse<ResolvedPolicy>> {
    return this.post(`${this.apiPrefix}/policy/resolve`, data, source);
  }
  public getPreferences(): Promise<ApiResponse<Preferences>> {
    return this.get(`${this.apiPrefix}/ui-preferences`);
  }
  public setPreferences(data: Preferences): Promise<ApiResponse<Preferences>> {
    return this.put(`${this.apiPrefix}/ui-preferences`, data);
  }

  public getNotificationProfiles(): Promise<ApiResponse<NotificationProfile[]>> {
    return this.get(`${this.apiPrefix}/notificationProfiles`);
  }
  public createNotificationProfile(profile: NotificationProfile): Promise<ApiResponse<NotificationProfile>> {
    return this.post(`${this.apiPrefix}/notificationProfiles`, profile);
  }
  public deleteNotificationProfile(profileName: string): Promise<ApiResponse<unknown>> {
    return this.delete(`${this.apiPrefix}/notificationProfiles/${profileName}`);
  }
  public testNotificationProfile(profile: NotificationProfile): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/testNotificationProfile`, profile);
  }
  public resolvePath(path: string): Promise<ApiResponse<ResolvePath>> {
    return this.post(`${this.apiPrefix}/paths/resolve`, {
      path
    });
  }
  public estimateSnapshot(data: EstimateSnapshotRequest): Promise<ApiResponse<Task>> {
    return this.post(`${this.apiPrefix}/estimate`, data);
  }
  public createSnapshot(data: CreateSnapshotRequest): Promise<ApiResponse<Task>> {
    return this.post(`${this.apiPrefix}/sources`, data);
  }
  public getCurrentUser(): Promise<ApiResponse<CurrentUser>> {
    return this.get(`${this.apiPrefix}/current-user`);
  }
  public repoExists(data: CheckRepoRequest): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/exists`, data);
  }
  public connectRepo(data: ConnectRepoRequest): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/connect`, data);
  }
  public createRepo(data: object): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/create`, data);
  }
  public disconnectRepo(): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/disconnect`);
  }
  public updateRepoDescription(description: string): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/description`, {
      description
    });
  }
  public deleteSnapshot(data: DeleteSnapshotRequest): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/snapshots/delete`, data);
  }
  public syncRepo(): Promise<ApiResponse<unknown>> {
    return this.post(`${this.apiPrefix}/repo/sync`);
  }

  public mountSnapshot(root: string): Promise<ApiResponse<MountedSnapshot>> {
    const req: MountSnapshotRequest = {
      root
    };
    return this.post(`${this.apiPrefix}/mounts`, req);
  }

  public getMountedSnapshot(root: string): Promise<ApiResponse<MountedSnapshot>> {
    return this.get(`${this.apiPrefix}/mounts/${root}`);
  }
  public unMountSnapshot(root: string): Promise<ApiResponse<unknown>> {
    return this.delete(`${this.apiPrefix}/mounts/${root}`);
  }
  public getMountedSnapshots(): Promise<ApiResponse<MountsResponse>> {
    return this.get(`${this.apiPrefix}/mounts`);
  }

  // Privates
  private async requestWrapper<T>(requestFunc: () => Promise<T>): Promise<ApiResponse<T>> {
    try {
      const response = await requestFunc();
      return {
        isError: false,
        data: response,
        responseCode: 200
      };
    } catch (error) {
      console.log(error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          this.onAuthRequired();
        }
        return {
          isError: true,
          responseCode: error.response?.status || 500,
          originResponseCode: error.response?.status || 500,
          data: error.response?.data
        };
      } else {
        return {
          isError: true,
          responseCode: 500,
          originResponseCode: 500
        };
      }
    }
  }
  private async get<T>(
    path: string,
    query?: { [key: string]: string },
    auth?: { username: string; password: string }
  ): Promise<ApiResponse<T>> {
    return await this.requestWrapper(async () => {
      const response = await axios({
        method: "GET",
        url: path,
        headers: kopiaRequestHeaders(),
        auth: auth || this.authInfo,
        params: query
      });
      return response.data;
    });
  }
  private async post<TRequest, TResponse>(
    path: string,
    body?: TRequest,
    query?: QueryParams
  ): Promise<ApiResponse<TResponse>> {
    return await this.requestWrapper(async () => {
      const response = await axios({
        method: "POST",
        url: path,
        headers: kopiaRequestHeaders(),
        data: body,
        params: query,
        auth: this.authInfo
      });
      return response.data;
    });
  }

  private async put<TRequest, TResponse>(
    path: string,
    body?: TRequest,
    query?: QueryParams
  ): Promise<ApiResponse<TResponse>> {
    return await this.requestWrapper(async () => {
      const response = await axios({
        method: "PUT",
        url: path,
        headers: kopiaRequestHeaders(),
        data: body,
        params: query,
        auth: this.authInfo
      });
      return response.data;
    });
  }
  private async delete<T>(path: string, params?: QueryParams): Promise<ApiResponse<T>> {
    return await this.requestWrapper(async () => {
      const response = await axios({
        method: "DELETE",
        url: path,
        headers: kopiaRequestHeaders(),
        params,
        auth: this.authInfo
      });
      return response.data;
    });
  }
}
