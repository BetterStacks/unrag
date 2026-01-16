declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
	export const getDocument: (params: unknown) => {promise: Promise<unknown>}
	export const VerbosityLevel: {ERRORS?: number} | undefined
	export const setVerbosityLevel: ((level: number) => void) | undefined
}
