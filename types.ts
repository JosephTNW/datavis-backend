export type PredictReturn = {
	type: string;
	time: Date;
	data: [string, [string[]] | undefined, string];
	endpoint: string;
	fn_index: number;
};
