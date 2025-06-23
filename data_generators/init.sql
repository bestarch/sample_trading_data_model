DO
$$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'portfolio') THEN
        RAISE NOTICE 'Schema already exists. Skipping initialization.';
        RETURN;
    END IF;

    CREATE SCHEMA portfolio;
    SET search_path TO portfolio;

    CREATE TABLE stock_master (
        ticker VARCHAR(30) PRIMARY KEY,
        description VARCHAR(100),
        exchange VARCHAR(10) NOT NULL,
        stockListDate VARCHAR(30),
        is_active SMALLINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
    );

    CREATE TABLE investor (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255),
        uid VARCHAR(15),
        pan VARCHAR(10),
        email VARCHAR(255),
        phone VARCHAR(20),
        address TEXT
    );

    CREATE TABLE account (
        id VARCHAR PRIMARY KEY,
        investorId VARCHAR NOT NULL,
        accountNo VARCHAR UNIQUE NOT NULL,
        accountOpenDate VARCHAR(30),
        accountCloseDate VARCHAR(30),
        retailInvestor BOOLEAN,
        FOREIGN KEY (investorId) REFERENCES investor(id)
    );

    CREATE TABLE securitylot (
        id VARCHAR(255) PRIMARY KEY,
        accountNo VARCHAR(255) NOT NULL,
        ticker VARCHAR(30),
        date TIMESTAMP,
        price DECIMAL(10, 2),
        quantity INT,
        lotValue DECIMAL(15, 2),
        type VARCHAR(50),
        description VARCHAR(255),
        FOREIGN KEY (accountNo) REFERENCES account(id),
        FOREIGN KEY (ticker) REFERENCES stock_master(ticker)
    );

END;
$$;
