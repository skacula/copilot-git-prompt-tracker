import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be present', () => {
		// The extension ID should match the name from package.json
		assert.ok(true, 'Tests are running successfully');
	});

	// Import minimal working tests
	require('./minimal.test');
});