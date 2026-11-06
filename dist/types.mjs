// src/types.ts
const ChordFamily = {
	power: "power",
	triad: "triad",
	sixth: "sixth",
	seventh: "seventh",
	ninth: "ninth",
	eleventh: "eleventh",
	thirteenth: "thirteenth"
};
const voicingNames = [
	"rootPosition",
	"closed",
	"dynamic",
	"dynamicBass",
	"open",
	"guitar",
	"drop2",
	"drop3",
	"drop4",
	"drop2and3",
	"drop2and4",
	"spread",
	"shell"
];
const voicingMinimumNotes = {
	drop2: 4,
	drop3: 4,
	drop4: 4,
	drop2and3: 4,
	drop2and4: 4,
	shell: 2
};
export { ChordFamily, voicingMinimumNotes, voicingNames };

//# sourceMappingURL=types.mjs.map