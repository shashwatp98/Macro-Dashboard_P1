export type DataSourceTag = 'live' | 'cache' | 'fallback';

export type DataSources = {
	markets: DataSourceTag;
	macro: DataSourceTag;
	centralBanks: DataSourceTag;
	fedWatch: DataSourceTag;
	releaseAlerts: DataSourceTag;
};

export type LiveQuote = {
	price: number;
	changePct: number;
	changeAbs?: number;
};

export type LiveAbsLevel = {
	price: number;
	change: number;
};

export type MacroStatus =
	| 'HOT BEAT'
	| 'COOL MISS'
	| 'EXP. BEAT'
	| 'MISS'
	| 'INLINE'
	| 'PENDING'
	| null;

export type MacroBlock = {
	price: number;
	changeFromPrior: number;
	forecast: number;
	status: MacroStatus;
};

export type CentralBanks = {
	us: string;
	eu: string;
	in: string;
	jp: string;
	ca: string;
	gb: string;
	au: string;
};

export type MacroPayloadKey = 'uscpi' | 'uscpicore' | 'uspce' | 'usnfp' | 'usur' | 'usgdp';

export type MacroBlocksBundle = Record<MacroPayloadKey, MacroBlock>;

export type YahooMarketPayload = {
	liveBitcoin: LiveQuote;
	spx: LiveQuote;
	ndx: LiveQuote;
	dji: LiveQuote;
	ftse: LiveQuote;
	nse: LiveQuote;
	csi: LiveQuote;
	gold: LiveQuote;
	silver: LiveQuote;
	crude: LiveQuote;
	dxy: LiveQuote;
	usdjpy: LiveQuote;
	usdinr: LiveQuote;
	us10y: LiveQuote;
	us30y: LiveQuote;
};

export type YieldSpreadPayload = {
	us2y: LiveQuote;
	us10y: LiveQuote;
	us30y: LiveQuote;
	spread2s10s: LiveAbsLevel;
	spread10s30s: LiveAbsLevel;
};
