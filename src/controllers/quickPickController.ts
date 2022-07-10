import { ExtensionContext, QuickPickItemKind, window, QuickPickItem, workspace, commands, Uri, ProgressLocation, FileSystemProvider } from 'vscode';
const fs = require('fs');
const path = require('path');
const Readable = require('stream').Readable;

import fetch from 'node-fetch';

class PayloadCategoryItem implements QuickPickItem {
    label: string;
    index: number;

    constructor(public itemLabel: string, public itemIndex: number) {
        this.label = itemLabel;
        this.index = itemIndex;
    }
}

class PayloadItem implements QuickPickItem {
    label: string;
    index: number;
    response: PayloadResponse;

    constructor(public itemLabel: string, public itemIndex: number, public itemResponse: PayloadResponse) {
        this.label = itemLabel;
        this.index = itemIndex;
        this.response = itemResponse;
    }
}

type PayloadResponse = {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    type: string;
}

export class QuickPickController {
    private extensionContent: ExtensionContext;

    public constructor(context: ExtensionContext) {
        this.extensionContent = context;
    }

    public async showQuickPick() {
        const categories: PayloadCategoryItem[] = [new PayloadCategoryItem('Credentials', 0), new PayloadCategoryItem('Execution', 1), new PayloadCategoryItem('Exfiltration', 2), new PayloadCategoryItem('General', 3), new PayloadCategoryItem('Incident Response', 4), new PayloadCategoryItem('Mobile', 5), new PayloadCategoryItem('Phishing', 6), new PayloadCategoryItem('Prank', 7), new PayloadCategoryItem('Reconnaissance', 8), new PayloadCategoryItem('Remote Access', 9)]

        const quickPick = window.createQuickPick();
        quickPick.items = categories;
        quickPick.placeholder = 'Choose Payload Category';

        quickPick.onDidChangeSelection(selection => {
            if (selection[0] && selection[0] instanceof PayloadCategoryItem) {
                this.retrievePayloadsForCategory(selection[0]);
            }
        })

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    }

    private async retrievePayloadsForCategory(category: PayloadCategoryItem) {
        const files = ['credentials', 'execution', 'exfiltration', 'general', 'incident_response', 'mobile', 'phishing', 'prank', 'recon', 'remote_access'];
        const selectedFile = files[category.index];
        const response = await fetch(`https://api.github.com/repos/hak5/usbrubberducky-payloads/contents/payloads/library/${selectedFile}`);
        const payloads = await response.json() as PayloadResponse[];
        const filteredPayloads = payloads.filter(obj => {
            return obj.name != 'placeholder';
        })
        this.showPayloadsForCategory(filteredPayloads);
    }

    public async showPayloadsForCategory(payloads: PayloadResponse[]) {
        console.log(payloads);
        const payloadItems: PayloadItem[] = payloads.map((payload, index) => {
            return new PayloadItem(payload.name, index, payload);
        })
        const quickPick = window.createQuickPick();
        quickPick.items = payloadItems;
        quickPick.placeholder = "Choose Payload";

        quickPick.onDidChangeSelection(selection => {
            if (selection[0] && selection[0] instanceof PayloadItem) {
                window.showInformationMessage(`Chose ${selection[0].itemLabel} payload!`);

                window.withProgress({
                    location: ProgressLocation.Window,
                    cancellable: false,
                    title: 'Loading payload'
                }, async (progress) => {
        
                    progress.report({ increment: 0 });

                    if (selection[0] instanceof PayloadItem) {
                        await this.choosePayload(selection[0]);
                    }
        
                    progress.report({ increment: 100 });
                });
            }
        })

        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    }

    public async choosePayload(payload: PayloadItem) {
        // gets files under the payload directory
        const payloadPath = payload.itemResponse.html_url.split('https://github.com/hak5/usbrubberducky-payloads/tree/master/')[1];
        let updatedURL = `https://api.github.com/repos/hak5/usbrubberducky-payloads/contents/${payloadPath}`;
        const response = await fetch(updatedURL);
        const files = await response.json();
        const correctPayloadFile = files.map((file: any) => {
            if(file.name == "payload.txt") {
                return file;
            }
        })
        await this.processPayloadFile(correctPayloadFile[0].path, payload.itemLabel);
    }

    public async processPayloadFile(payloadFilePath: string, payloadName: string) {
        let updatedFinalURL = `https://api.github.com/repos/hak5/usbrubberducky-payloads/contents/${payloadFilePath}`;
        const response2 = await fetch(updatedFinalURL);
        const payloads2 = await response2.json();

        if (!workspace || !workspace.workspaceFolders) {
            return window.showErrorMessage('Please open a project folder first');
        }

        const folderPath = workspace.workspaceFolders[0]?.uri
            .toString()
            .split(':')[1].concat(`/${payloadName}`);
            

        if (!fs.existsSync(`./${payloadName}`)) {
            await fs.mkdir(folderPath, (err: any) => {
                console.log("error", err)
            });
        } else {
            window.showErrorMessage('Payload already imported!')
        }

        const fileBuffer = Buffer.from(payloads2.content, 'base64')

        var stream = new Readable()

        stream.push(fileBuffer)   
        stream.push(null)

        stream.pipe(fs.createWriteStream(path.join(folderPath, payloads2.name)), (err: any) => {
            if (err) {
                return window.showErrorMessage(
                    'Failed to import payload!'
                );
            }
        });
    }

    public dispose() { }

}