import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway.js';
import { MessagesModule } from '../messages/messages.module.js';
import { LocationsModule } from '../locations/locations.module.js';

@Module({
    imports: [MessagesModule, LocationsModule],
    providers: [ChatGateway],
})
export class ChatModule { }
