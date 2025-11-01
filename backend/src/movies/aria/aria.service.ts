import { HttpService } from '@nestjs/axios';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AriaService {
  private readonly aria2Url = 'http://aria2:6800/jsonrpc';
  private readonly rpcSecret = 'token:superlongrandomtoken';

  constructor(private readonly http: HttpService) {}

  private async callAria2(method: string, params: any[] = []) {
    try {
      const response = await lastValueFrom(
        this.http.post(this.aria2Url, {
          jsonrpc: '2.0',
          id: Date.now(),
          method: `aria2.${method}`,
          params: [this.rpcSecret, ...params],
        }),
      );
      if (response.data.error) {
        throw new HttpException(response.data.error.message, HttpStatus.BAD_REQUEST);
      }
      return response.data.result;
    } catch (error: any) {
      throw new HttpException(error?.message ?? 'Unknown error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async addUri(uris: string[], options: Record<string, any> = {}) {
    return this.callAria2('addUri', [uris, options]);
  }

  async tellStatus(gid: string) {
    return this.callAria2('tellStatus', [gid]);
  }

  async removeDownload(gid: string) {
    return this.callAria2('remove', [gid]);
  }

  async tellActive() {
    return this.callAria2('tellActive');
  }

  async tellWaiting(offset = 0, num = 10) {
    return this.callAria2('tellWaiting', [offset, num]);
  }

  async tellStopped(offset = 0, num = 10) {
    return this.callAria2('tellStopped', [offset, num]);
  }
}
