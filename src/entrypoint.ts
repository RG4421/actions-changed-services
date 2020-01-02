import * as core from '@actions/core';
import * as github from '@actions/github';

const getChangedPackages = async () => {
  const token = process.env.GITHUB_TOKEN!;
  const octokit = new github.GitHub(token);

  let allFilenames: string[];

  if (github.context.eventName === 'pull_request') {
    const pullNumber = github.context.payload!.pull_request!.number;
    core.info(`📝 Determining chnaged files for PR ${pullNumber}`);

    const { data: files } = await octokit.pulls.listFiles({
      ...github.context.repo,
      pull_number: pullNumber,
    });

    allFilenames = files.map(file => file.filename);
  } else if (github.context.eventName === 'push') {
    const ref = process.env.GITHUB_SHA!;
    core.info(`📝 Determining chnaged files for ref ${ref}`);

    const { data } = await octokit.repos.getCommit({
      ...github.context.repo,
      ref: process.env.GITHUB_SHA!,
    });

    allFilenames = data.files.map(file => file.filename);
  } else {
    throw new Error(`Unexpected event ${github.context.eventName}`);
  }

  // @TODO This assumes standard structure of lerna monorepos
  const packageFilenames = allFilenames.filter(filename => filename.startsWith('packages/'));
  const packages = Array.from(new Set(packageFilenames.map(filename => filename.split('/')[1])));

  core.info(`📦 Changed packages: ${packages}`);
  return packages;
};

const splitAcrossNodes = (packages: string[]) => {
  let packagesForNode: string[] = [];

  if (!process.env.BUILD_NODE_INDEX || ! process.env.BUILD_NODE_TOTAL) {
    packagesForNode = packages;
  } else {
    const nodeIndex = parseInt(process.env.BUILD_NODE_INDEX, 10) - 1;
    const nodeTotal = parseInt(process.env.BUILD_NODE_TOTAL, 10);
    packagesForNode = packages.filter((_, index) => index % nodeTotal === nodeIndex);
  }

  core.info(`📦 Changed packages on node: ${packagesForNode}`);
  core.exportVariable('CHANGED_PACKAGES', packagesForNode.join(','));
  return packagesForNode;
};

getChangedPackages()
  .then(splitAcrossNodes)
  .catch(error => {
    core.setFailed(`❌ Job failed: ${error.message}`);
  });
