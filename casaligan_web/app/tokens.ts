export const colors = {
	background: 'var(--color-background)',
	foreground: 'var(--color-foreground)',
	primary: 'var(--color-primary)',
	primaryForeground: 'var(--color-primary-foreground)',
	secondary: 'var(--color-secondary)',
	accent: 'var(--color-accent)',
	tertiary: 'var(--color-tertiary)',
	danger: 'var(--color-danger)',
	muted: 'var(--color-muted)',
	border: 'var(--color-border)'
} as const;

export const fonts = {
	sans: 'var(--font-sans)',
	headings: 'var(--font-heading)',
	mono: 'var(--font-mono)'
} as const;

export type ColorToken = keyof typeof colors;
export type FontToken = keyof typeof fonts;

export function getColor(token: ColorToken): string {
	return colors[token];
}

export function getFont(token: FontToken): string {
	return fonts[token];
}


