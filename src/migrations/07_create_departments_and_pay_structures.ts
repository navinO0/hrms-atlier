import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  // 1. Create Departments Table
  await queryInterface.createTable("Departments", {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 2. Create PayStructures Table
  await queryInterface.createTable("PayStructures", {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    daysPerPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  const now = new Date();

  // 3. Seed Departments
  await queryInterface.bulkInsert("Departments", [
    { id: "dept-stitching", name: "Stitching Section", createdAt: now, updatedAt: now },
    { id: "dept-qa", name: "Quality Assurance", createdAt: now, updatedAt: now },
    { id: "dept-cutting", name: "Cutting Department", createdAt: now, updatedAt: now },
    { id: "dept-finishing", name: "Finishing Section", createdAt: now, updatedAt: now },
    { id: "dept-housekeeping", name: "House Keeping", createdAt: now, updatedAt: now },
    { id: "dept-others", name: "Others", createdAt: now, updatedAt: now },
  ]);

  // 4. Seed PayStructures
  await queryInterface.bulkInsert("PayStructures", [
    { id: "ps-monthly", name: "Monthly", daysPerPeriod: 26, createdAt: now, updatedAt: now },
    { id: "ps-weekly", name: "Weekly", daysPerPeriod: 6, createdAt: now, updatedAt: now },
    { id: "ps-hourly", name: "Hourly", daysPerPeriod: 0, createdAt: now, updatedAt: now },
  ]);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable("Departments");
  await queryInterface.dropTable("PayStructures");
}
