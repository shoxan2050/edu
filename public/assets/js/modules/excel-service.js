export const ExcelService = {
    canonicalKeys: ['fan', 'tartib', 'mavzu', 'uygavazifa', 'sinf'],

    mappings: {
        fan: ['fan', 'subject', 'dars', 'subjectname', 'fan-nomi'],
        tartib: ['tartib', 'order', 'nomer', 'number', '№', 'pos', 'index'],
        mavzu: ['mavzu', 'topic', 'lesson', 'title', 'tema', 'dars-nomi'],
        uygavazifa: ['uygavazifa', 'homework', 'vazifa', 'task', 'vazifalar'],
        sinf: ['sinf', 'class', 'grade', 'level', 'group']
    },

    normalizeKey(s) {
        return s.toString().toLowerCase().trim().replace(/[\s_-]+/g, '');
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
            rows: []
        };

        const subjectOrders = {}; // Cache to detect duplicates: { subjectName: [orders] }

        data.forEach((row, index) => {
            const errors = [];
            const rowData = {
                _rowIndex: index + 1,
                fan: row[keyMap['fan']]?.toString().trim(),
                tartib: parseInt(row[keyMap['tartib']]),
                mavzu: row[keyMap['mavzu']]?.toString().trim(),
                uygavazifa: row[keyMap['uygavazifa']]?.toString().trim(),
                sinf: parseInt(row[keyMap['sinf']])
            };

            if (!rowData.fan) errors.push("Fan nomi yo'q");
            if (isNaN(rowData.tartib)) errors.push("Tartib raqam emas");
            if (!rowData.mavzu) errors.push("Mavzu nomi yo'q");
            if (isNaN(rowData.sinf)) errors.push("Sinf raqam emas or yo'q");
            else if (rowData.sinf < 1 || rowData.sinf > 11) errors.push("Sinf 1-11 oraliqda bo'lishi kerak");

            // Duplicate order check
            if (rowData.fan && !isNaN(rowData.tartib)) {
                // Normalize Key for Duplication Check
                const normFan = rowData.fan.toLowerCase().trim();

                if (!subjectOrders[normFan]) subjectOrders[normFan] = new Set();
                if (subjectOrders[normFan].has(rowData.tartib)) {
                    errors.push(`Duplicate tartib: ${rowData.tartib}`);
                }
                subjectOrders[normFan].add(rowData.tartib);
            }

            const isError = errors.length > 0;
            if (isError) report.errorCount++;
            else report.validCount++;

            report.rows.push({
                data: rowData,
                errors,
                isError,
                raw: row
            });
        });

        return report;
    }
};
