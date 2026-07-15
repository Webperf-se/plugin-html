import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HtmlValidate } from 'html-validate';

export class HarAnalyzer {
    constructor() {
        this.groups = {};

        const libFolder = fileURLToPath(new URL('..', import.meta.url));
        this.pluginFolder = path.resolve(libFolder, '..');
        const configPath = path.resolve(libFolder, 'configurations', 'standard.json');
        this.config = JSON.parse(readFileSync(configPath, 'utf8'));
        this.rules = this.config.rules;
        const packagePath = path.resolve(libFolder, 'package.json');
        this.package = JSON.parse(readFileSync(packagePath, 'utf8'));
        this.dependencies = this.package.dependencies;
        this.version = this.package.version;
    }
    getFirstPageEntries(url, harData) {
        if ('log' in harData) {
            harData = harData['log'];
        }

        const entries = harData.entries;
        if (!Array.isArray(entries)) {
            return [];
        }

        // A HAR can contain more than one page, for example when a concurrent
        // browsertime run ends up in the same browser session (crossed DevTools
        // port) and navigates to another website mid-recording. Requests made
        // by other pages must not be attributed to the tested website, and if
        // the recording doesn't even start with the tested website nothing in
        // it can be trusted.
        if (url && entries.length > 0) {
            const firstUrl = entries[0].request && entries[0].request.url;
            if (firstUrl) {
                try {
                    if (new URL(firstUrl).hostname !== new URL(url).hostname) {
                        return [];
                    }
                } catch {
                    // Unparsable URLs are handled by the entry loops as before
                }
            }
        }

        const pages = harData.pages;
        if (!Array.isArray(pages) || pages.length === 0) {
            return entries;
        }
        const firstPageId = pages[0].id;
        if (firstPageId === undefined) {
            return entries;
        }
        return entries.filter(entry =>
            entry.pageref === undefined || entry.pageref === firstPageId);
    }

    transform2SimplifiedData(harData, url) {
        const data = {
            'url': url,
            'htmls': []
        };

        let reqIndex = 1;

        for (const entry of this.getFirstPageEntries(url, harData)) {
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
            'issues': {}
        };

        if (analyzedData === undefined) {
            return knowledgeData;
        }

        if (!('htmls' in analyzedData)) {
            return knowledgeData;
        }

        if (analyzedData['htmls'].length === 0) {
            knowledgeData['issues'] = {
                'no-network': {
                    'test': 'html',
                    'rule': 'no-network',
                    'category': 'technical',
                    'severity': 'warning',
                    'subIssues': [
                        {
                            'url': url,
                            'rule': 'no-network',
                            'category': 'standard',
                            'severity': 'warning',
                            'text': `No HTML content found in the HAR file.`,
                            'line': 0,
                            'column': 0
                        }
                    ]
                }
            };
            return knowledgeData;
        }

        // https://html-validate.org/rules/presets.html
        // Validate HTML content using html-validate
        // config = { extends: ["html-validate:standard"] })
        const htmlValidate = new HtmlValidate(this.config);
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
        const lintResults = await Promise.all(validationPromises);
        const flatResults = lintResults.flat();

        // Convert issues to a set grouped by rule
        const issuesByRule = {};
        for (const issue of flatResults) {
            if (!issuesByRule[issue.rule]) {
                issuesByRule[issue.rule] = {
                    'test': 'html',
                    rule: issue.rule,
                    category: issue.category,
                    severity: issue.severity,
                    resources: [],
                    subIssues: []
                };
                issuesByRule[issue.rule]['resources'].push('https://html-validate.org/rules/' + issue.rule + '.html');
            }
            issuesByRule[issue.rule].subIssues.push(issue);
        }

        // Add missing rules from securityConfig and standardConfig
        const allRules = [
            ...Object.keys(this.rules || {}).filter(rule => this.rules[rule] !== "off")
        ];

        for (const rule of allRules) {
            if (!issuesByRule[rule]) {
                issuesByRule[rule] = {
                    'test': 'html',
                    rule: rule,
                    category: 'standard',
                    severity: 'resolved', // Default severity for missing issues
                    resources: [],
                    subIssues: []
                };
                issuesByRule[rule]['resources'].push('https://html-validate.org/rules/' + rule + '.html');
            }
        }

        knowledgeData.issues = issuesByRule;

        return knowledgeData;
    }

    async analyzeData(url, harData, group) {
        if (this.groups[group] === undefined) {
            this.groups[group] = {};
        }

        const analyzedData = this.transform2SimplifiedData(harData, url);
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
            'version': this.version,
            'dependencies': this.dependencies,
            'url': url,
            'analyzedData': analyzedData,
            'knowledgeData': knowledgeData
        };
    }

    getSummary() {
        return this;
    }
}