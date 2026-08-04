import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable("PayrollRecords", {
    id: { type: DataTypes.STRING, primaryKey: true },
    employeeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: { model: "Employees", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    netHours: { type: DataTypes.FLOAT, allowNull: false },
    grossHours: { type: DataTypes.FLOAT, allowNull: false },
    lunchDeductionHours: { type: DataTypes.FLOAT, allowNull: false },
    payType: { type: DataTypes.STRING, allowNull: false },
    payRate: { type: DataTypes.FLOAT, allowNull: false },
    periodStart: { type: DataTypes.STRING, allowNull: false },
    periodEnd: { type: DataTypes.STRING, allowNull: false },
    paidAt: { type: DataTypes.STRING, allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable("PayrollRecords");
}
