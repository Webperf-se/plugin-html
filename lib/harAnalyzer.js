import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HtmlValidate } from 'html-validate';

export class HarAnalyzer {
    constructor() {
        this.groups = {};

        const libFolder = fileURLToPath(new URL('..', import.meta.url));
        this.pluginFolder = path.resolve(libFolder, '..');
    }
    transform2SimplifiedData(harData, url, group) {
        const data = {
            'url': url,
            'htmls': []
        };

        if ('log' in harData) {
            harData = harData['log'];
        }

        let reqIndex = 1;

        for (const entry of harData.entries) {
            const req = entry.request;
            const res = entry.response;
            const reqUrl = req.url;

            if (!res.content || !res.content.text || !res.content.mimeType || !res.content.size || res.content.size <= 0 || !res.status) {
                continue;
            }

            const obj = {
                'url': reqUrl,
                'content': res.content.text,
                'index': reqIndex
            };
            if (res.content.mimeType.includes('html')) {
                data.htmls.push(obj);
            }

            reqIndex++;
        }

        return data;
    }

    async createKnowledgeFromData(analyzedData, url, group) {
        let knowledgeData = {
            'url': url,
            'group': group,
            'issues': [],
            'resolved-rules': []
        };

        if (analyzedData === undefined) {
            return knowledgeData;
        }

        if (!('htmls' in analyzedData)) {
            return knowledgeData;
        }

        try {
            // Validate HTML content using html-validate
            const htmlValidate = new HtmlValidate({ extends: ["html-validate:standard"] });
            const validationPromises = analyzedData['htmls'].map(async entry => {
                const report = await htmlValidate.validateString(entry.content);
          
                return report.results.flatMap(result =>
                    result.messages.map(message => ({
                        url: entry.url,
                        rule: message.ruleId,
                        category: 'standard',
                        severity: message.severity === 2 ? 'error' : 'warning',
                        text: message.message,
                        line: message.line,
                        column: message.column
                    }))
                );
            });

            // Wait for all validation promises to resolve and flatten the results
            const validationResults = await Promise.all(validationPromises);
            knowledgeData.issues = validationResults.flat();
        } catch (err) {
            // console.error('Error during validation:', err);
        }

        return knowledgeData;
    }

    async analyzeData(url, harData, group) {
        if (this.groups[group] === undefined) {
            this.groups[group] = {};
        }

        const analyzedData = this.transform2SimplifiedData(harData, url, group);
        if (!('analyzedData' in this.groups[group])) {
            this.groups[group]['analyzedData'] = []
        }
        this.groups[group]['analyzedData'].push(analyzedData);

        const knowledgeData = await this.createKnowledgeFromData(analyzedData, url, group);
        if (!('knowledgeData' in this.groups[group])) {
            this.groups[group]['knowledgeData'] = []
        }
        this.groups[group]['knowledgeData'].push(knowledgeData);

        return {
            'url': url,
            'analyzedData': analyzedData,
            'knowledgeData': knowledgeData
        };
    }

    getSummary() {
        return this;
    }
}