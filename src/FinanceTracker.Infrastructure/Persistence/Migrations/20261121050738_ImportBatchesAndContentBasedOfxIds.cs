using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceTracker.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ImportBatchesAndContentBasedOfxIds : Migration
    {
        // Same text as ExternalIds.Ofx: "~yyyyMMdd~-50.00".
        private const string OfxSuffix = "'~' + CONVERT(char(8), [Date], 112) + '~' + CONVERT(varchar(40), Amount)";

        private const string IsCsvId =
            "LEN(ExternalId) >= 64 AND LEFT(ExternalId, 64) NOT LIKE '%[^0-9A-F]%' " +
            "AND (LEN(ExternalId) = 64 OR SUBSTRING(ExternalId, 65, 1) = '#')";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "ExternalId",
                table: "Transactions",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(255)",
                oldMaxLength: 255);

            // OFX ids now include date and amount. Rewrites stored ids so re-importing old statements stays idempotent.
            // CSV ids (64 hex chars, optional "#n") do not change.
            migrationBuilder.Sql($"""
                UPDATE Transactions
                SET ExternalId = ExternalId + {OfxSuffix}
                WHERE NOT ({IsCsvId});
                """);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Transactions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                collation: "Latin1_General_CI_AI",
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500);

            migrationBuilder.AddColumn<Guid>(
                name: "ImportId",
                table: "Transactions",
                type: "uniqueidentifier",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImportId",
                table: "Transactions");

            migrationBuilder.Sql($"""
                UPDATE Transactions
                SET ExternalId = LEFT(ExternalId, LEN(ExternalId) - LEN({OfxSuffix}))
                WHERE NOT ({IsCsvId}) AND RIGHT(ExternalId, LEN({OfxSuffix})) = {OfxSuffix};
                """);

            migrationBuilder.AlterColumn<string>(
                name: "ExternalId",
                table: "Transactions",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(300)",
                oldMaxLength: 300);

            migrationBuilder.AlterColumn<string>(
                name: "Description",
                table: "Transactions",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(500)",
                oldMaxLength: 500,
                oldCollation: "Latin1_General_CI_AI");
        }
    }
}
