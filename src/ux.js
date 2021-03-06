var vscode = require('vscode');
var config = require('./config');
var constants = config.getConstants();
var azure = require('./azure');
var path = require('path');
var fs = require('fs');
var fsPath = require('fs-path');

// perform the export template feature
exports.exportTemplate = function exportTemplate(state) {
    this.getResourceGroups(state)
        .then(function () {
            vscode.window.showQuickPick(state.resourceGroupList)
                .then(function (selectedRg) {
                    if (!selectedRg) reject();
                    state.resourceGroupToUse = selectedRg;
                    azure.exportTemplate(state)
                        .then((result) => {
                            var json = JSON.stringify(result.template);
                            var filename = path.join(vscode.workspace.rootPath, constants.armTemplatesPath, state.resourceGroupToUse, 'azuredeploy.json');
                            fsPath.writeFile(filename, json, (err) => {
                                if (result.error) {
                                    vscode.window.showErrorMessage(constants.promptTemplateExportedWithErrors.replace('{0}', state.resourceGroupToUse));
                                }
                                else {
                                    vscode.window.showInformationMessage(constants.promptTemplateExported.replace('{0}', state.resourceGroupToUse));
                                }
                                vscode.workspace.openTextDocument(filename)
                                .then(prms => {
                                    vscode.window.showTextDocument(prms);
                                });
                            });
                        });
                });
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
};

// check to see if the user is logged in
exports.isLoggedIn = function isLoggedIn(state) {
    return new Promise((resolve, reject) => {
        if (state && state.credentials && state.accessToken && (state.subscriptions && state.subscriptions.length > 0)) {
            resolve();
        }
        else {
            vscode.window.showErrorMessage(constants.promptNotLoggedIn);
        }
    });
};

// deploys arm template
exports.deployTemplate = function deployTemplate(state) {
    state.statusBar = vscode.window.setStatusBarMessage(constants.promptDeployingTemplate
        .replace('{0}', state.selectedTemplateName)
        .replace('{1}', state.resourceGroupToUse))

    azure.deployTemplate(state)
        .then((msg) => {
            vscode.window.showInformationMessage(msg);
            state.statusBar.dispose();
        })
        .catch((err) => {
            vscode.window.showErrorMessage(constants.promptDeployingTemplateFailed
                .replace('{0}', state.selectedTemplateName)
                .replace('{1}', state.resourceGroupToUse));
            state.statusBar.dispose();
        });
};

// get the list of resource groups from the subscription
exports.getResourceGroups = function getResourceGroups(state) {
    return new Promise(function (resolve, reject) {
        azure
            .getResourceGroups(state)
            .then(function (result) {
                result.forEach(function (rg) {
                    state.resourceGroupList.push(rg.name);
                });
                resolve();
            })
            .catch(function (err) {
                reject(err);
            });
    });
};

// wrapper method for handling "new or existing resource group" workflows
exports.showNewOrExistingResourceGroupMenu = function showNewOrExistingResourceGroupMenu(state) {
    return new Promise((resolve, reject) => {
        vscode.window.showQuickPick([
            constants.optionExistingRg,
            constants.optionNewRg
        ]).then(selected => {
            if (selected == constants.optionExistingRg) {
                this.getResourceGroups(state)
                    .then(function () {
                        vscode.window.showQuickPick(state.resourceGroupList)
                            .then(function (selectedRg) {
                                if (!selectedRg) reject();
                                state.resourceGroupToUse = selectedRg;
                                resolve();
                            });
                    })
                    .catch(function (err) {
                        vscode.window.showErrorMessage(err);
                    });
            }
            else if (selected == constants.optionNewRg) {
                vscode.window.showInputBox({
                    prompt: constants.promptNewRgName
                }).then(function (newResourceGroupName) {
                    if (!newResourceGroupName || newResourceGroupName === "") reject();
                    state.resourceGroupToUse = newResourceGroupName;
                    azure.createNewResourceGroup(state).then(() => {
                        resolve();
                    });
                });
            }
        });
    });
};

// check the site's name
exports.ifWebSiteNameIsAvailable = function ifWebSiteNameIsAvailable(state) {
    return new Promise(function (resolve, reject) {
        azure
            .checkSiteNameAvailability(state)
            .then(function (result) {
                if (!result.nameAvailable) {
                    // name isn't available so we bail out'
                    reject(constants.promptWebSiteNameNotAvailable);
                }
                else {
                    resolve();
                }
            });
    });
};

// check the storage account's name
exports.ifStorageAccountNameIsAvailable = function ifStorageAccountNameIsAvailable(state) {
    return new Promise(function (resolve, reject) {
        azure
            .checkStorageAccountNameAvailability(state)
            .then(function (result) {
                if (!result.nameAvailable) {
                    // name isn't available so we bail out'
                    reject(constants.promptStorageAccountNameNotAvailable);
                }
                else {
                    resolve();
                }
            });
    });
};

// check the key vault name is available
exports.ifKeyVaultNameIsAvailable = function ifKeyVaultNameIsAvailable(state) {
    return new Promise(function (resolve, reject) {
        azure
            .checkKeyVaultNameAvailability(state)
            .then(function (result) {
                if (!result) {
                    // name isn't available so we bail out'
                    reject(constants.promptKeyVaultNameNotAvailable);
                }
                else {
                    resolve();
                }
            });
    });
}

// check the batch account name is available
exports.ifBatchAccountNameIsAvailable = function ifBatchAccountNameIsAvailable(state){
    return new Promise(function (resolve, reject){
        azure
            .checkBatchAccountNameAvailability(state)
            .then(function (result){
                if(!result){
                    reject(constants.promptBatchAccountNameNotAvailable);
                }
                else{
                    resolve();
                }
            });
    });
}

// gets all of the resources
exports.getAzureResources = function getAzureResources(state) {
    return new Promise((function (resolve, reject) {
        var statusBar = vscode.window.setStatusBarMessage(constants.statusGettingResources);
        azure
            .getFullResourceList(state)
            .then(function (names) {
                statusBar.dispose();
                resolve(names);
            })
            .catch(function (err) {
                reject(err);
            });
    }));
};

// creates a new key vault
exports.createKeyVault = function createKeyVault(state, callback) {
    vscode.window.setStatusBarMessage(constants.statusCreatingKeyVault.replace('{0}', state.keyVaultName));
    azure
        .createNewKeyVault(state)
        .then(function (result) {
            vscode.window.setStatusBarMessage(constants.statusCreatedKeyVault.replace('{0}', state.keyVaultName));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

exports.createBatchAccount = function createBatchAccount(state, callback){
    vscode.window.setStatusBarMessage(constants.statusCreatingBatchAccount.replace('{0}', state.batchAccountName));
    azure
        .createNewBatchAccount(state)
        .then(function (result) {
            vscode.window.setStatusBarMessage(constants.statusCreatedBatchAccount.replace('{0}', state.batchAccountName));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

// method to create the resource group
exports.createResourceGroup = function createResourceGroup(state, callback) {
    vscode.window.setStatusBarMessage(constants.statusCreatingResourceGroup.replace('{0}', state.resourceGroupToUse));

    azure
        .createNewResourceGroup(state)
        .then(function (result) {
            vscode.window.setStatusBarMessage(constants.statusCreatedResourceGroup.replace('{0}', state.resourceGroupToUse));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

// create the server farm
exports.createServerFarm = function createServerFarm(state, callback) {
    vscode.window.setStatusBarMessage(constants.statusCreatingServerFarm.replace('{0}', state.selectedServerFarm));

    azure
        .createNewServerFarm(state)
        .then(function (result) {
            vscode.window.setStatusBarMessage(constants.statusCreatedResourceGroup.replace('{0}', state.selectedServerFarm));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

// creates the web app based on the state persisted up to this point
exports.createWebApp = function createWebApp(state, callback) {
    vscode.window.setStatusBarMessage(constants.promptWebAppCreationInProcess.replace('{0}', state.newWebAppName));

    azure
        .createWebApp(state)
        .then(function (result) {
            console.log(result);
            vscode.window.setStatusBarMessage(constants.promptWebAppCreated.replace('{0}', state.newWebAppName));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

// creates the function app based on the state persisted up to this point
exports.createFunction = function createFunction(state, callback) {
    vscode.window.setStatusBarMessage(constants.promptFunctionAppCreationInProcess.replace('{0}', state.newWebAppName));

    azure
        .createFunction(state)
        .then(function (result) {
            console.log(result);
            vscode.window.setStatusBarMessage(constants.promptFunctionAppCreated.replace('{0}', state.newWebAppName));
            if (callback != null)
                callback();
        })
        .catch(function (err) {
            vscode.window.showErrorMessage(err);
        });
}

// gets all the hosting plans
exports.getServerFarms = function getServerFarms(state) {
    return new Promise(function (resolve, reject) {
        state.serverFarmList = [];
        var statusBar = vscode.window.setStatusBarMessage(constants.statusGettingFarms);
        azure
            .getServerFarms(state)
            .then(function (result) {
                statusBar.dispose();
                if (result.length == 0)
                    resolve();
                else {
                    result.forEach(function (farm, index, arr) {
                        state.serverFarmList.push(farm.name);
                        if (index == arr.length - 1) {
                            resolve();
                        }
                    });
                }
            })
            .catch(function (err) {
                reject(err);
            });
    });
}

// lists all storage accounts in subscription
exports.getStorageAccounts = function getStorageAccounts(state) {
    return new Promise(function (resolve, reject) {
        state.storageAccountList = [];
        azure
            .getStorageAccounts(state)
            .then(function (result) {
                if (result.length === 0)
                    vscode.window.showErrorMessage(constants.promptNoStorageAccount);
                else {
                    result.forEach((item, index, arr) => {
                        state.storageAccountList.push(item);
                        if (index === arr.length - 1)
                            resolve();
                    });
                }
            })
            .catch(function (err) {
                vscode.window.showErrorMessage(err);
            });
    });
}

// create new storage account
exports.createStorageAccount = function createStorageAccount(state, callback) {
    return new Promise((resolve, reject) => {
        vscode.window.setStatusBarMessage(constants.statusCreatingStorageAccount.replace('{0}', state.selectedStorageAccount));
        azure
            .createStorageAccount(state)
            .then((result) => {
                vscode.window.setStatusBarMessage(constants.statusCreatedStorageAccount.replace('{0}', state.selectedStorageAccount));
                if (callback !== null)
                    callback(result);
            })
            .catch(function (err) {
                vscode.window.showErrorMessage(err);
            });
    });
}

// list storage account keys
exports.getStorageAccountKeys = function getStorageAccountKeys(state) {

    return new Promise(function (resolve, reject) {
        azure
            .getStorageAccountKeys(state)
            .then(function (result) {
                if (result.keys.length == 0)
                    reject();
                else {
                    state.storageAccountKeyList = [];

                    if (result.keys.length != 0)
                        resolve();
                    else
                        reject();

                    result.keys.forEach(function (item, index, arr) {
                        state.storageAccountKeyList.push(item);
                    });
                }
            })
            .catch(function (err) {
                vscode.window.showErrorMessage(err);
                reject();
            });
    });
};

var buttons = [];

exports.showSubscriptionStatusBarButton = function showSubscriptionStatusBarButton() {
    showButton('selectsubscription', '$(cloud-upload)', 'Select the active Azure subscription');
};

exports.showSelectRegionStatusBarButton = function showSelectRegionStatusBarButton() {
    showButton('selectRegion', '$(globe)', 'Select your desired Azure region');
};

exports.getRegions = function getRegions(state) {
    return new Promise(function (resolve, reject) {
        azure
            .getRegions(state)
            .then(function (result) {
                state.regions = result;
                state.selectedRegion = state.regions[0].displayName;
                resolve();
            })
            .catch(function (err) {
                vscode.window.showErrorMessage(err);
            });
    });
};

exports.getRegionsForResource = function getRegionsForResource(state, resourceProvider, resourceType) {
    return new Promise(function (resolve, reject) {
        azure
            .getRegionsForResource(state, resourceProvider, resourceType)
            .then(function (result) {
                resolve(result);
            })
            .catch(function (err) {
                vscode.window.showErrorMessage(err);
            });
    });
}

exports.showResourceGroupsMenu = function showResourceGroupsMenu(state, callback) {
    var resourceGroupNames = state.resourceGroupList.map(function (x) { return x; });
    vscode.window.showQuickPick(resourceGroupNames).then(function (selected) {
        if (!selected) return;

        state.resourceGroupToUse = selected;
        vscode.window.setStatusBarMessage(constants.statusResourceGroupSelected.replace('{0}', state.resourceGroupToUse));

        if (callback !== null)
            callback();
    });
};

exports.showRegionMenu = function showRegionMenu(state) {
    var regionNames = state.regions.map(function (x) { return x.displayName; });
    vscode.window.showQuickPick(regionNames).then(function (selected) {
        if (!selected) return;

        state.selectedRegion = selected;
        vscode.window.setStatusBarMessage(constants.statusRegionSelected.replace('{0}', state.selectedRegion));
        updateButtonTooltip('selectRegion', constants.btnRegionSelectionLabel + '('
            + constants.statusRegionSelected.replace('{0}', state.selectedRegion) + ')');

    });
};

exports.showStorageAccountMenu = function showStorageMenu(state) {
    return new Promise(function (resolve, reject) {
        var storageAccountNames = state.storageAccountList.map(function (x) { return x.name; });
        vscode.window.showQuickPick(storageAccountNames).then(function (selected) {
            if (!selected)
                resolve(null);
            else {
                state.selectedStorageAccount = selected;
                vscode.window.setStatusBarMessage(constants.statusStorageAccountSelected.replace('{0}', state.selectedStorageAccount));
                updateButtonTooltip('selectStorageAccount', constants.btnStorageSelectionLabel + '('
                    + constants.statusStorageAccountSelected.replace('{0}', state.selectedStorageAccount) + ')');
                resolve(selected);
            }
        });
    });
};

function showButton(command, text, tooltip) {
    var customStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
    customStatusBarItem.color = 'white';
    customStatusBarItem.command = command;
    customStatusBarItem.text = text;
    customStatusBarItem.tooltip = tooltip;
    customStatusBarItem.show();
    buttons.push(customStatusBarItem);
};

function updateButtonTooltip(command, tooltip) {
    var x = buttons.filter(function (f) {
        return f.command == command;
    });
    if (x != null && x.length > 0)
        x[0].tooltip = tooltip;
};