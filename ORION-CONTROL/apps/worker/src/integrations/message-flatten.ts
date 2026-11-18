import type { Message } from 'discord.js';
import type { FlattenedEmbed, FlattenedMessage } from '../parsers/message-parser.js';

export type { FlattenedEmbed, FlattenedMessage };

export function flattenDiscordMessageSafe(message: Message): FlattenedMessage {
  const embeds: FlattenedEmbed[] = message.embeds.slice(0, 10).map((embed) => ({
    title: embed.title ?? '',
    description: embed.description ?? '',
    fields: (embed.fields ?? []).slice(0, 25).map((field) => ({
      name: field.name,
      value: field.value,
    })),
    footer: embed.footer?.text ?? '',
  }));

  return {
    content: message.content ?? '',
    embeds,
    attachments: [...message.attachments.values()].slice(0, 10).map((attachment) => attachment.name),
    authorTag: message.author.tag,
    authorId: message.author.id,
    createdAt: new Date(message.createdTimestamp).toISOString(),
  };
}

export function flattenText(message: FlattenedMessage): string {
  const parts: string[] = [message.content];
  for (const embed of message.embeds) {
    if (embed.title) parts.push(embed.title);
    if (embed.description) parts.push(embed.description);
    for (const field of embed.fields) parts.push(`${field.name}: ${field.value}`);
    if (embed.footer) parts.push(embed.footer);
  }
  return parts.filter((part) => part.trim().length > 0).join('\n');
}
