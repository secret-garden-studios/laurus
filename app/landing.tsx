import { italiana } from "./fonts";
import styles from "./app.module.css";

export default function Landing() {
    return (<div
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
        }
        }>
        {"Laurus"}
    </div>)
}