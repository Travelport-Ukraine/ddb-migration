import { builder as migrationBuilder } from './migrate';
import { MigrateCommandArgs, prepare } from '../core/prepare';
import { MigrationModule } from '../core/generate';
import * as path from 'path';
import ora from 'ora';
import * as fs from 'fs';

export const builder = migrationBuilder;

export async function handler(args: MigrateCommandArgs) {
  const spinner = ora();
  const register = await prepare(args);

  spinner.start('Fetching list of migrations from DB');
  const migrationList = await register.list();

  migrationList.reverse();

  if (!migrationList.length) {
    spinner.fail('No migrations left');
    process.exit(0);
  }

  migrationList.forEach((migration) => {
    const isMigrationExists = fs.existsSync(
      path.join(process.cwd(), args.path, migration.name),
    );

    if (!isMigrationExists) {
      spinner.fail(
        `Migration does not exists in the filesystem ${
          migration.name
        }. Aborting`,
      );
      process.exit(0);
    }
  });

  await migrationList.map((m) => m.name).reduce(async (acc, fileName) => {
    await acc;
    const module: MigrationModule = require(path.join(
      process.cwd(),
      args.path,
      fileName,
    ));
    spinner.start(`Undoing migration of ${fileName}`);
    await module.down(register.awsConfig, register.ddb, register.ddbClient);
    await register.pop();
    spinner.succeed(`Finished undo ${fileName}`);
  }, Promise.resolve());

  process.exit(0);
}
