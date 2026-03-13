import { italiana } from "./fonts";
import styles from "./app.module.css";
import Link from "next/link";

export default function Landing() {
    return (
        <Link href="/workspace" style={{ textDecoration: 'none' }}>
            <div
                className={italiana.className + ' ' + styles["grainy-background"]}
                style={{
                    color: 'rgb(239, 239, 239)',
                    fontSize: 32,
                    letterSpacing: 10,
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer'
                }
                }>
                {"Laurus"}
            </div>
        </Link>
    );
}