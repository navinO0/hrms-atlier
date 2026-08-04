import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  const table = await queryInterface.describeTable("Employees");

  if (!table.payType) {
    await queryInterface.addColumn("Employees", "payType", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Monthly",
    });
  }

  if (!table.payRate) {
    await queryInterface.addColumn("Employees", "payRate", {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    });
  }

  if (!table.lastPaidAt) {
    await queryInterface.addColumn("Employees", "lastPaidAt", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.removeColumn("Employees", "payType");
  await queryInterface.removeColumn("Employees", "payRate");
  await queryInterface.removeColumn("Employees", "lastPaidAt");
}
