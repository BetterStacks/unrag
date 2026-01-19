/**
 * Mock data for the Terminal component demo.
 */

import type {
	ChunkDetail,
	ChunkRange,
	DocumentItem,
	TerminalStats
} from './terminal-types'

export const mockStats: TerminalStats = {
	adapter: 'drizzle',
	vectors: 164,
	dim: 1536,
	documents: 26,
	chunks: 164,
	embeddings: 164
}

export const mockDocuments: DocumentItem[] = [
	{sourceId: 'blog:resend:how-to-send-emails-using-bun', chunks: 4},
	{sourceId: 'blog:resend:improving-time-to-inbox-in-asia', chunks: 3},
	{sourceId: 'blog:resend:introducing-broadcast', chunks: 5},
	{sourceId: 'blog:resend:resend-for-startups', chunks: 2},
	{sourceId: 'blog:resend:building-email-infrastructure', chunks: 6},
	{sourceId: 'blog:resend:react-email-2-0', chunks: 4},
	{sourceId: 'blog:resend:email-authentication-guide', chunks: 7},
	{sourceId: 'blog:resend:smtp-vs-api', chunks: 3},
	{sourceId: 'blog:resend:deliverability-best-practices', chunks: 8},
	{sourceId: 'blog:resend:domain-verification', chunks: 4},
	{sourceId: 'blog:resend:webhook-events', chunks: 5},
	{sourceId: 'blog:resend:batch-emails', chunks: 3},
	{sourceId: 'blog:resend:email-templates', chunks: 6},
	{sourceId: 'blog:resend:attachments-guide', chunks: 4},
	{sourceId: 'blog:resend:rate-limiting', chunks: 2},
	{sourceId: 'blog:resend:error-handling', chunks: 5},
	{sourceId: 'blog:resend:testing-emails', chunks: 3},
	{sourceId: 'blog:resend:scheduling-emails', chunks: 4},
	{sourceId: 'blog:resend:email-analytics', chunks: 6},
	{sourceId: 'blog:resend:custom-headers', chunks: 2},
	{sourceId: 'blog:resend:reply-to-setup', chunks: 3},
	{sourceId: 'blog:resend:unsubscribe-links', chunks: 4},
	{sourceId: 'blog:resend:email-preview', chunks: 5},
	{sourceId: 'blog:resend:dark-mode-emails', chunks: 3},
	{sourceId: 'blog:resend:responsive-design', chunks: 7},
	{sourceId: 'blog:resend:accessibility-guide', chunks: 4}
]

export const mockChunkRanges: ChunkRange[] = [
	{range: '<50', count: 0},
	{range: '50-99', count: 1},
	{range: '100-199', count: 0},
	{range: '200-399', count: 3},
	{range: '400-799', count: 0},
	{range: '800+', count: 0}
]

export const mockChunkDetails: Record<string, ChunkDetail[]> = {
	'blog:resend:how-to-send-emails-using-bun': [
		{
			idx: 0,
			tokens: 200,
			content:
				'# How to send emails using Bun\n\nRendering React emails and sending them with Resend is incredibly fast with Bun runtime...'
		},
		{
			idx: 1,
			tokens: 185,
			content:
				'## Setting up the project\n\nFirst, create a new Bun project and install the required dependencies...'
		},
		{
			idx: 2,
			tokens: 220,
			content:
				'## Creating the email template\n\nUsing React Email components, we can build beautiful templates...'
		},
		{
			idx: 3,
			tokens: 175,
			content:
				'## Sending the email\n\nWith the Resend SDK, sending is as simple as calling resend.emails.send()...'
		}
	],
	'blog:resend:improving-time-to-inbox-in-asia': [
		{
			idx: 0,
			tokens: 245,
			content:
				"# Improving Time to Inbox in Asia\n\nWe've optimized our infrastructure for faster email delivery across Asian markets..."
		},
		{
			idx: 1,
			tokens: 190,
			content:
				'## New regional endpoints\n\nOur Singapore and Tokyo data centers now serve as primary routing points...'
		},
		{
			idx: 2,
			tokens: 210,
			content:
				'## Benchmark results\n\nAverage delivery time improved from 4.2s to 1.8s for major providers...'
		}
	],
	'blog:resend:introducing-broadcast': [
		{
			idx: 0,
			tokens: 180,
			content:
				'# Introducing Broadcast\n\nA new way to send marketing emails at scale with Resend...'
		},
		{
			idx: 1,
			tokens: 195,
			content:
				'## Features overview\n\nBroadcast includes audience segmentation, A/B testing, and analytics...'
		},
		{
			idx: 2,
			tokens: 220,
			content:
				'## Getting started\n\nCreate your first broadcast campaign in just a few steps...'
		},
		{
			idx: 3,
			tokens: 165,
			content:
				'## Pricing\n\nBroadcast is included in all paid plans starting at 10,000 contacts...'
		},
		{
			idx: 4,
			tokens: 200,
			content:
				'## Migration guide\n\nMoving from other email marketing platforms is straightforward...'
		}
	]
}

/**
 * Logo pixel art data from /packages/unrag/registry/debug/tui/assets/unragLogo.ts
 * 'g' = filled pixel (rendered as block), 'u' = empty pixel (whitespace)
 */
export const UNRAG_LOGO_LINES: string[] = [
	'gggggggggguuuuuugggggggggguuuuugggggggguuuuuuuuggggggggguuuuuuggggggggggggggggguuuuuuuuuuuuuuuuuuuuuggggggggggguuuuuuuuuuuuuuuuuuuggggggggggggguuuuuuu',
	'gggggggggguuuuuugggggggggguuuuuggggggggguuuuuuuggggggggguuuuuugggggggggggggggggggguuuuuuuuuuuuuuuuuggggggggggggguuuuuuuuuuuuuuuuggggggggggggggggguuuuu',
	'gggggggggguuuuuugggggggggguuuuugggggggggguuuuuuggggggggguuuuuugggggggggggggggggggggguuuuuuuuuuuuuuuggggggggggggguuuuuuuuuuuuuugggggggggggggggggggguuuu',
	'gggggggggguuuuuugggggggggguuuuuggggggggggguuuuuggggggggguuuuuuggggggggggggggggggggggguuuuuuuuuuuuugggggggggggggguuuuuuuuuuuuuggggggggggggggggggggggguu',
	'gggggggggguuuuuuggggguuuuuuuuuuggggggggggguuuuuggggggggguuuuuugggggggggggggggggggggggguuuuuuuuuuuuggggggggggggggguuuuuuuuuuugggggggggggggggggggggggggu',
	'gggggggggguuuuuuuuuuuuuuuuuuuuugggggggggggguuuuggggggggguuuuuuggggggggggggggggggggggggguuuuuuuuuugggggggggggggggguuuuuuuuuuggggggggggggguugggggggggggu',
	'ggggggggguuuuuuuuuuuuuuggguuuuuggggggggggggguuuggggggggguuuuuugggggggggguuuuggggggggggguuuuuuuuuuggggggggggggggggguuuuuuuuuggggggggggguuuuuggggggggggg',
	'gggggguuuuuuuuuuuggggggggguuuuugggggggggggggguuggggggggguuuuuugggggggggguuuuugggggggggguuuuuuuuuuggggggggggggggggguuuuuuuuugggggggggguuuuuuugggggggggg',
	'uuuuuuuuuuuuuuuugggggggggguuuuugggggggggggggguuggggggggguuuuuugggggggggguuuuugggggggggguuuuuuuuuggggggggggggggggggguuuuuuugggggggggguuuuuuuugggggggggg',
	'uuuuuuuggguuuuuugggggggggguuuuuggggggggggggggguggggggggguuuuuugggggggggguuuugggggggggguuuuuuuuuuggggggggguggggggggguuuuuuugggggggggguuuuuuuuuuuuuuuuuu',
	'uugggggggguuuuuugggggggggguuuuuggggggggggggggggggggggggguuuuuugggggggggggggggggggggggguuuuuuuuugggggggggguggggggggguuuuuuugggggggggguuuugggggggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggggggggggggggggggguuuuuugggggggggggggggggggggguuuuuuuuuuuggggggggguugggggggggguuuuuugggggggggguuuugggggggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggggggggggggggggggguuuuuugggggggggggggggggggguuuuuuuuuuuugggggggggguuuggggggggguuuuuugggggggggguuuugggggggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggguggggggggggggggguuuuuuggggggggggggggggggggggguuuuuuuuuggggggggguuuugggggggggguuuuugggggggggguuuugggggggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggguugggggggggggggguuuuuugggggggggggggggggggggggguuuuuuuuggggggggggggggggggggggguuuuugggggggggguuuugggggggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggguuuggggggggggggguuuuuuggggggggggugggggggggggggguuuuuugggggggggggggggggggggggguuuuuggggggggggguuuuuuuuggggggggg',
	'gggggggggguuuuuugggggggggguuuuuggggggggguuuggggggggggggguuuuuugggggggggguuuuugggggggggguuuuuuggggggggggggggggggggggggguuuuuggggggggggguuuuuugggggggggg',
	'ggggggggggguuuugggggggggguuuuuuggggggggguuuugggggggggggguuuuuugggggggggguuuuugggggggggguuuuugggggggggggggggggggggggggguuuuuggggggggggggguuuggggggggggg',
	'ggggggggggggggggggggggggguuuuuuggggggggguuuuuggggggggggguuuuuugggggggggguuuuugggggggggguuuuuggggggggggggggggggggggggggguuuuugggggggggggggggggggggggggg',
	'uggggggggggggggggggggggguuuuuuuggggggggguuuuuugggggggggguuuuuugggggggggguuuuugggggggggguuuuuggggggggguuuuuuuugggggggggguuuuuuggggggggggggggggggggggggg',
	'uuggggggggggggggggggggguuuuuuuuggggggggguuuuuugggggggggguuuuuugggggggggguuuuuugggggggggguuugggggggggguuuuuuuuugggggggggguuuuuugggggggggggggggggggggggg',
	'uuuugggggggggggggggggguuuuuuuuuggggggggguuuuuuuggggggggguuuuuugggggggggguuuuuugggggggggguuuggggggggguuuuuuuuuugggggggggguuuuuuuugggggggggggggggugggggg',
	'uuuuuuugggggggggggguuuuuuuuuuuuggggggggguuuuuuuugggggggguuuuuuggggggggguuuuuuugggggggggguugggggggggguuuuuuuuuugggggggggguuuuuuuuuuuggggggggggguugggggg'
]

export const mockSessionId = 'cb1b711d-8f2e-4a5c-b9d3-2e8f1a3c4b5d'
