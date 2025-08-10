import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('app')
@Controller()
export class AppController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns a hello world message',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Hello World!'
        }
      }
    }
  })
  getHello() {
    return { message: 'Hello World!' };
  }
}
