export const ExcelService = {
    canonicalKeys: ['fan', 'tartib', 'mavzu', 'uygavazifa', 'sinf', 'daraja', 'resurs', 'test'],

    mappings: {
        fan: ['fan', 'subject', 'dars', 'subjectname', 'fan-nomi', 'modul', 'modulnomi'],
        tartib: ['tartib', 'order', 'nomer', 'number', '№', 'pos', 'index'],
        mavzu: ['mavzu', 'topic', 'lesson', 'title', 'tema', 'dars-nomi', 'darssarlavhasi'],
        uygavazifa: ['uygavazifa', 'homework', 'vazifa', 'task', 'vazifalar'],
        sinf: ['sinf', 'class', 'grade', 'level', 'group'],
        daraja: ['daraja', 'difficulty', 'qiyinchilik', 'qiyinchilikdarajasi', 'level'],
        resurs: ['resurs', 'resource', 'havola', 'link', 'video', 'pdf', 'resurshavolasi'],
        test: ['test', 'savol', 'savollar', 'testsavollari', 'question', 'questions']
    },

    // Valid difficulty levels
    validDarajaValues: ["boshlang'ich", "o'rta", "yuqori", "beginner", "intermediate", "advanced"],

    normalizeKey(s) {
        return s.toString().toLowerCase().trim().replace(/[\s_-]+/g, '');
    },

    normalizeDaraja(value) {
        if (!value) return null;
        const normalized = value.toString().toLowerCase().trim();

        // Map aliases to canonical values
        const darajaMap = {
            "boshlang'ich": "boshlang'ich",
            "beginner": "boshlang'ich",
            "easy": "boshlang'ich",
            "boshlanish": "boshlang'ich",
            "o'rta": "o'rta",
            "intermediate": "o'rta",
            "medium": "o'rta",
            "orta": "o'rta",
            "yuqori": "yuqori",
            "advanced": "yuqori",
            "hard": "yuqori",
            "qiyin": "yuqori"
        };

        return darajaMap[normalized] || null;
    },

    autoMap(headers) {
        const keyMap = {};
        headers.forEach(header => {
            const normalized = this.normalizeKey(header);
            for (const [canonical, aliases] of Object.entries(this.mappings)) {
                if (aliases.includes(normalized) || normalized.includes(canonical)) {
                    if (!keyMap[canonical]) keyMap[canonical] = header;
                }
            }
        });
        return keyMap;
    },

    generateId(prefix = 'ID') {
        const uuid = (typeof self !== 'undefined' && self.crypto && self.crypto.randomUUID)
            ? self.crypto.randomUUID()
            : Math.random().toString(36).substr(2, 9);
        return `${prefix}-${uuid}`;
    },

    validateRows(data, keyMap) {
        const report = {
            validCount: 0,
            errorCount: 0,
            warningCount: 0,
            rows: []
        };

        const subjectOrders = {}; // Cache to detect duplicates: { subjectName: [orders] }

        data.forEach((row, index) => {
            const errors = [];
            const warnings = [];

            // Extract raw values
            const rawDaraja = row[keyMap['daraja']]?.toString().trim();
            const rawResurs = row[keyMap['resurs']]?.toString().trim();
            const rawTest = row[keyMap['test']]?.toString().trim();

            const rowData = {
                _rowIndex: index + 1,
                fan: row[keyMap['fan']]?.toString().trim(),
                tartib: parseInt(row[keyMap['tartib']]),
                mavzu: row[keyMap['mavzu']]?.toString().trim(),
                uygavazifa: row[keyMap['uygavazifa']]?.toString().trim(),
                sinf: parseInt(row[keyMap['sinf']]),
                daraja: this.normalizeDaraja(rawDaraja),
                resurs: rawResurs || null,
                test: rawTest || null
            };

            // Required field validations
            if (!rowData.fan) errors.push("Fan/Modul nomi yo'q");
            if (isNaN(rowData.tartib)) errors.push("Tartib raqam emas");
            if (!rowData.mavzu) errors.push("Mavzu/Dars sarlavhasi yo'q");
            if (isNaN(rowData.sinf)) errors.push("Sinf raqam emas yoki yo'q");
            else if (rowData.sinf < 1 || rowData.sinf > 11) errors.push("Sinf 1-11 oraliqda bo'lishi kerak");

            // Daraja validation (optional but if provided, must be valid)
            if (rawDaraja && !rowData.daraja) {
                errors.push(`Qiyinchilik darajasi noto'g'ri: "${rawDaraja}". Faqat: Boshlang'ich, O'rta, Yuqori`);
            }

            // Resource URL validation (optional)
            if (rowData.resurs && !this.isValidResourceLink(rowData.resurs)) {
                warnings.push("Resurs havolasi noto'g'ri formatda bo'lishi mumkin");
            }

            // Test format validation (optional)
            if (rowData.test && !this.isValidTestFormat(rowData.test)) {
                warnings.push("Test formati noto'g'ri bo'lishi mumkin (JSON yoki Q1:...|Q2:... formatda bo'lishi kerak)");
            }

            // Duplicate order check
            if (rowData.fan && !isNaN(rowData.tartib)) {
                const normFan = rowData.fan.toLowerCase().trim();

                if (!subjectOrders[normFan]) subjectOrders[normFan] = new Set();
                if (subjectOrders[normFan].has(rowData.tartib)) {
                    errors.push(`Takroriy tartib: ${rowData.tartib}`);
                }
                subjectOrders[normFan].add(rowData.tartib);
            }

            const isError = errors.length > 0;
            const hasWarning = warnings.length > 0;

            if (isError) report.errorCount++;
            else report.validCount++;
            if (hasWarning) report.warningCount++;

            report.rows.push({
                data: rowData,
                errors,
                warnings,
                isError,
                hasWarning,
                raw: row
            });
        });

        return report;
    },

    isValidResourceLink(link) {
        if (!link) return true;
        // Check if it's a URL or a valid file extension
        const urlPattern = /^(https?:\/\/|www\.)/i;
        const filePattern = /\.(mp4|mp3|pdf|docx?|xlsx?|pptx?|jpg|png|gif)$/i;
        return urlPattern.test(link) || filePattern.test(link);
    },

    isValidTestFormat(test) {
        if (!test) return true;
        // Check for JSON format
        try {
            JSON.parse(test);
            return true;
        } catch (e) {
            // Check for Q1:...|Q2:... format
            const qFormat = /Q\d+\s*[:=]/i;
            return qFormat.test(test);
        }
    }
};
